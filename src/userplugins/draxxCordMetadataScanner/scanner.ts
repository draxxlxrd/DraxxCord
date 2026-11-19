/*
 * DraxxCord MetadataScanner — standalone compatibility port.
 * Based on feature set of the b4lCord MetadataViewer index (GPL-3.0-or-later).
 * Original contribution: SirPhantom89. Port implementation: DraxxCord.
 * Does not send analysis data to a third party.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface MetadataResult {
    format: string;
    bytes: number;
    entries: { key: string; value: string }[];
    warnings: string[];
}

const decoder = new TextDecoder("utf-8", { fatal: false });
const MAX_BYTES = 20 * 1024 * 1024;
const printable = (text: string) => text.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 1000);
const getText = (b: Uint8Array, start: number, len: number) => decoder.decode(b.subarray(start, start + Math.max(0, len)));
const ascii = (b: Uint8Array, start: number, len: number) => Array.from(b.subarray(start, start + len), x => String.fromCharCode(x)).join("");
const add = (out: MetadataResult, key: string, value: string) => { if (value && out.entries.length < 180) out.entries.push({ key, value: printable(value) }); };

function inspectExif(data: Uint8Array, out: MetadataResult) {
    try {
        let offset = 0;
        if (ascii(data, 0, 6) === "Exif\0\0") offset = 6;
        if (data.byteLength < offset + 8) return;
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const endian = ascii(data, offset, 2);
        if (endian !== "II" && endian !== "MM") return;
        const le = endian === "II";
        const get16 = (p: number) => view.getUint16(p, le);
        const get32 = (p: number) => view.getUint32(p, le);
        if (get16(offset + 2) !== 42) return;
        const tagNames: Record<number, string> = {
            0x0100: "Image width", 0x0101: "Image height", 0x010f: "Camera manufacturer",
            0x0110: "Camera model", 0x0112: "Orientation", 0x0131: "Software",
            0x0132: "Modified date", 0x013b: "Artist", 0x8298: "Copyright",
            0x9003: "Date taken", 0x9004: "Date digitized", 0x8827: "ISO",
            0xa002: "Pixel width", 0xa003: "Pixel height", 0x920a: "Focal length",
            0x0001: "GPS latitude reference", 0x0002: "GPS latitude",
            0x0003: "GPS longitude reference", 0x0004: "GPS longitude",
            0x0005: "GPS altitude reference", 0x0006: "GPS altitude"
        };
        const valueSize: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
        const gps: Record<number, string> = {};
        const visited = new Set<number>();
        function directory(relative: number, prefix: string, depth: number) {
            if (depth > 5 || visited.has(relative)) return;
            visited.add(relative);
            const pos = offset + relative;
            if (relative < 8 || pos + 2 > view.byteLength) return;
            const count = Math.min(get16(pos), 350);
            if (pos + 2 + count * 12 > view.byteLength) return;
            for (let i = 0; i < count; i++) {
                const p = pos + 2 + i * 12;
                const tag = get16(p), type = get16(p + 2), n = get32(p + 4);
                const size = valueSize[type];
                if (!size || !n || n > 100000) continue;
                const length = n * size;
                if (length > 1024 * 1024) continue;
                const start = length <= 4 ? p + 8 : offset + get32(p + 8);
                if (start < offset || start + length > view.byteLength) continue;
                if ((tag === 0x8769 || tag === 0x8825 || tag === 0xa005) && type === 4) {
                    directory(get32(start), tag === 0x8825 ? "GPS" : "EXIF", depth + 1);
                    continue;
                }
                const label = tagNames[tag];
                if (!label) continue;
                let value = "";
                if (type === 2 || type === 7) value = ascii(data, start, Math.min(n, 350)).replace(/\0/g, " ").trim();
                else if (type === 1) value = Array.from(data.subarray(start, start + Math.min(n, 24))).join(", ");
                else if (type === 3 || type === 4) {
                    value = Array.from({ length: Math.min(n, 5) }, (_, j) => String(type === 3 ? get16(start + j * 2) : get32(start + j * 4))).join(", ");
                } else if (type === 5 || type === 10) {
                    value = Array.from({ length: Math.min(n, 4) }, (_, j) => {
                        const a = type === 5 ? get32(start + j * 8) : view.getInt32(start + j * 8, le);
                        const b = type === 5 ? get32(start + j * 8 + 4) : view.getInt32(start + j * 8 + 4, le);
                        return b ? String(+(a / b).toFixed(7)) : "?";
                    }).join(", ");
                }
                if (prefix === "GPS") gps[tag] = value;
                add(out, prefix + " • " + label, value);
            }
            const next = pos + 2 + count * 12;
            if (depth === 0 && next + 4 <= view.byteLength) {
                const relativeNext = get32(next);
                if (relativeNext) directory(relativeNext, "EXIF", depth + 1);
            }
        }
        directory(get32(offset + 4), "EXIF", 0);
        const convert = (v: string) => {
            const a = v.split(",").map(Number);
            return a.length >= 3 && a.every(Number.isFinite) ? a[0] + a[1] / 60 + a[2] / 3600 : null;
        };
        const lat = convert(gps[2] || ""), lon = convert(gps[4] || "");
        if (lat !== null && lon !== null) {
            const signedLat = lat * (gps[1]?.startsWith("S") ? -1 : 1);
            const signedLon = lon * (gps[3]?.startsWith("W") ? -1 : 1);
            add(out, "GPS COORDINATES", `${signedLat.toFixed(6)}, ${signedLon.toFixed(6)}`);
            out.warnings.push("This file contains GPS location data. Avoid sharing it without review.");
        }
    } catch { out.warnings.push("Some EXIF fields could not be decoded."); }
}

export function scanImage(buffer: ArrayBuffer): MetadataResult {
    if (buffer.byteLength > MAX_BYTES) throw Error("File exceeds the 20 MB scan limit.");
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const out: MetadataResult = { format: "Unknown", bytes: bytes.length, entries: [], warnings: [] };
    if (bytes.length >= 8 && ascii(bytes, 1, 3) === "PNG") {
        out.format = "PNG";
        let pos = 8, chunks = 0;
        while (pos + 12 <= bytes.length && chunks++ < 1500) {
            const len = view.getUint32(pos);
            const type = ascii(bytes, pos + 4, 4);
            if (len > bytes.length - pos - 12) { out.warnings.push("Malformed PNG chunk length."); break; }
            const dataPos = pos + 8;
            if (type === "IHDR" && len >= 8) {
                add(out, "Width", String(view.getUint32(dataPos)));
                add(out, "Height", String(view.getUint32(dataPos + 4)));
            }
            if (type === "tEXt") add(out, "PNG text", getText(bytes, dataPos, Math.min(len, 900)));
            if (type === "iTXt") add(out, "PNG international text", getText(bytes, dataPos, Math.min(len, 900)));
            if (type === "zTXt") add(out, "PNG compressed text", "Present (not decompressed)");
            if (type === "eXIf") inspectExif(bytes.subarray(dataPos, dataPos + len), out);
            if (type === "tIME" && len >= 7) add(out, "PNG modified timestamp", `${view.getUint16(dataPos)}-${bytes[dataPos + 2]}-${bytes[dataPos + 3]}`);
            pos += 12 + len;
            if (type === "IEND") break;
        }
    } else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        out.format = "JPEG";
        let pos = 2, blocks = 0;
        while (pos + 4 <= bytes.length && blocks++ < 600) {
            if (bytes[pos] !== 0xff) break;
            while (pos < bytes.length && bytes[pos] === 0xff) pos++;
            const marker = bytes[pos++];
            if (marker === 0xd9 || marker === 0xda) break;
            if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
            if (pos + 2 > bytes.length) break;
            const len = view.getUint16(pos);
            if (len < 2 || pos + len > bytes.length) { out.warnings.push("Invalid JPEG marker length."); break; }
            const start = pos + 2;
            if (marker === 0xe1) {
                if (ascii(bytes, start, 6) === "Exif\0\0") inspectExif(bytes.subarray(start, pos + len), out);
                else if (ascii(bytes, start, 20).includes("xmp")) add(out, "XMP metadata", "Present");
            }
            if (marker === 0xed) add(out, "IPTC / Photoshop metadata", "APP13 block present");
            if (marker === 0xfe) add(out, "JPEG comment", getText(bytes, start, Math.min(len - 2, 700)));
            pos += len;
        }
    } else if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
        out.format = "WebP";
        let pos = 12, blocks = 0;
        while (pos + 8 <= bytes.length && blocks++ < 900) {
            const type = ascii(bytes, pos, 4), len = view.getUint32(pos + 4, true), start = pos + 8;
            if (len > bytes.length - start) break;
            if (type === "EXIF") inspectExif(bytes.subarray(start, start + len), out);
            if (type === "XMP ") add(out, "XMP metadata", "Present");
            if (type === "ICCP") add(out, "ICC color profile", "Present");
            pos += 8 + len + (len & 1);
        }
    } else out.warnings.push("Only PNG, JPEG and WebP metadata scanning is supported.");
    if (!out.entries.length) out.warnings.push("No recognized metadata fields found; this is not a guarantee that metadata is absent.");
    return out;
}

// Conservative cleaner: don't re-encode pixels. Disabled by default.
// Deliberately leaves WebP untouched: VP8X flags must be updated to remove EXIF safely.
export async function stripImageMetadata(file: File): Promise<File> {
    const original = await file.arrayBuffer();
    const b = new Uint8Array(original), v = new DataView(original);
    const pieces: Uint8Array[] = [];
    if (b.length >= 8 && ascii(b, 1, 3) === "PNG") {
        pieces.push(b.subarray(0, 8));
        let pos = 8;
        while (pos + 12 <= b.length) {
            const len = v.getUint32(pos);
            if (len > b.length - pos - 12) return file;
            const type = ascii(b, pos + 4, 4);
            if (!new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]).has(type)) pieces.push(b.subarray(pos, pos + len + 12));
            pos += len + 12;
            if (type === "IEND") break;
        }
        if (pos !== b.length) return file;
    } else if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
        pieces.push(b.subarray(0, 2));
        let pos = 2, valid = false;
        while (pos < b.length) {
            if (b[pos] !== 0xff) return file;
            const begin = pos;
            while (pos < b.length && b[pos] === 0xff) pos++;
            if (pos >= b.length) return file;
            const marker = b[pos++];
            if (marker === 0xda || marker === 0xd9) { pieces.push(b.subarray(begin)); valid = true; break; }
            if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) { pieces.push(b.subarray(begin, pos)); continue; }
            if (pos + 2 > b.length) return file;
            const len = v.getUint16(pos);
            if (len < 2 || pos + len > b.length) return file;
            const chunkEnd = pos + len;
            if (![0xe1, 0xed, 0xfe].includes(marker)) pieces.push(b.subarray(begin, chunkEnd));
            pos = chunkEnd;
        }
        if (!valid) return file;
    } else return file;
    const total = pieces.reduce((n, p) => n + p.length, 0);
    if (total === b.length) return file;
    const output = new Uint8Array(total);
    let pos = 0; for (const piece of pieces) { output.set(piece, pos); pos += piece.length; }
    return new File([output], file.name, { type: file.type, lastModified: file.lastModified });
}

export async function fetchAndScan(url: string): Promise<MetadataResult> {
    const target = new URL(url);
    if (target.protocol !== "https:") throw Error("Only HTTPS attachment URLs can be scanned.");
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) throw Error(`Download failed (HTTP ${response.status}).`);
    const size = Number(response.headers.get("content-length") || 0);
    if (size > MAX_BYTES) throw Error("Attachment exceeds the 20 MB scan limit.");
    const b = await response.arrayBuffer();
    return scanImage(b);
}
