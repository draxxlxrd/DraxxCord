/* SPDX-License-Identifier: GPL-3.0-or-later */
import { Modal, React } from "@webpack/common";
import { fetchAndScan, MetadataResult, scanImage, stripImageMetadata } from "./scanner";

export function ScannerModal({ rootProps, url, name }: { rootProps: any; url?: string; name: string }) {
    const [result, setResult] = React.useState<MetadataResult | null>(null);
    const [loading, setLoading] = React.useState(!!url);
    const [error, setError] = React.useState("");
    const [currentFile, setCurrentFile] = React.useState<File | null>(null);
    const [currentName, setCurrentName] = React.useState(name);

    React.useEffect(() => {
        if (!url) return;
        let active = true;
        fetchAndScan(url).then(r => { if (active) setResult(r); }).catch(e => {
            if (active) setError(String(e?.message ?? e));
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [url]);

    async function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.currentTarget.files?.[0];
        if (!file) return;
        setCurrentFile(file);
        setCurrentName(file.name);
        setError("");
        setResult(null);
        setLoading(true);
        try { setResult(scanImage(await file.arrayBuffer())); }
        catch (e: any) { setError(String(e?.message ?? e)); }
        finally { setLoading(false); }
    }

    async function saveCleanCopy() {
        if (!currentFile) return;
        setError("");
        try {
            if (!/\.(png|jpe?g)$/i.test(currentFile.name)) throw Error("Cleaning supports PNG and JPEG only.");
            const clean = await stripImageMetadata(currentFile);
            const href = URL.createObjectURL(clean);
            const link = document.createElement("a");
            link.href = href;
            link.download = `clean-${currentFile.name}`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(href), 30000);
        } catch (e: any) { setError(String(e?.message ?? e)); }
    }

    return (
        <Modal {...rootProps} size="lg" title="DraxxCord MetadataScanner" subtitle={currentName}
            actions={[{ text: "Close", variant: "secondary", onClick: rootProps.onClose }]}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "10px 4px", maxHeight: "65vh", overflowY: "auto" }}>
                <div style={{ fontSize: 13, opacity: 0.85 }}>Local metadata inspection for PNG, JPEG and WebP images. No scan results are uploaded by this plugin.</div>
                <label style={{ display: "block", fontWeight: 600 }}>
                    Inspect a local image:
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectFile} style={{ display: "block", marginTop: 7, maxWidth: "100%" }}/>
                </label>
                {loading && <div>Reading image metadata…</div>}
                {!!error && <div style={{ padding: 8, border: "1px solid #ed4245", borderRadius: 6, color: "#ff8588", overflowWrap: "anywhere" }}>{error}</div>}
                {result && <>
                    <div><strong>{result.format}</strong> · {(result.bytes / 1024).toFixed(1)} KiB · {result.entries.length} recognized fields</div>
                    {result.warnings.map((w, i) => <div key={i} style={{ padding: 8, borderRadius: 6, background: "rgba(237,66,69,0.15)", fontSize: 12 }}>{w}</div>)}
                    <div style={{ border: "1px solid var(--background-modifier-accent)", borderRadius: 6, overflow: "hidden" }}>
                        {result.entries.map((entry, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(130px, 36%) 1fr", gap: 12, padding: "6px 9px", borderBottom: "1px solid var(--background-modifier-accent)", fontSize: 12 }}>
                            <strong>{entry.key}</strong><span style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{entry.value}</span>
                        </div>)}
                    </div>
                </>}
                {currentFile && <button type="button" onClick={() => void saveCleanCopy()} style={{ padding: "9px 12px", border: 0, borderRadius: 5, background: "#2d8a56", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                    Save cleaned local copy (PNG / JPEG)
                </button>}
                <div style={{ fontSize: 11, opacity: 0.65 }}>Cleaner conservatively removes known EXIF/text blocks without changing image pixels. It does not guarantee all identifying information is removed. WebP cleaning is intentionally unavailable.</div>
            </div>
        </Modal>
    );
}
