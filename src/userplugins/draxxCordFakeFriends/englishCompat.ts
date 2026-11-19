/* DraxxCord Vencord adapter: Arabic source strings were corrupted by the source-map extraction.
 * Use the original English fallback to avoid displaying mojibake in the UI.
 */
export const t = (_arabic: string, english: string): string => english;
export const isArabicMode = (): boolean => false;
