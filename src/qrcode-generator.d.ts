// qrcode-generator.d.ts — Tipado mínimo para el paquete qrcode-generator (sin tipos propios).
declare module 'qrcode-generator' {
  interface QRCode {
    addData(data: string, mode?: string): void;
    make(): void;
    createSvgTag(opts?: { cellSize?: number; margin?: number; scalable?: boolean }): string;
    createDataURL(cellSize?: number, margin?: number): string;
    createImgTag(cellSize?: number, margin?: number): string;
    getModuleCount(): number;
  }
  function qrcode(typeNumber: number, errorCorrectionLevel: string): QRCode;
  export default qrcode;
}
