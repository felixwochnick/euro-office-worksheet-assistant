// The shared modules (packages/shared) are plain CommonJS without type declarations; abc.ts and
// worksheet.ts give them their types.
declare module '@worksheet-assistant/shared/*' {
  const mod: unknown;
  export default mod;
}
