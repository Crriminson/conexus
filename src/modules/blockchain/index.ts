export async function registerDocumentHash(projectId: string, exportArtifactId: string) {
  // Stub blockchain logic
  console.log(`[Blockchain] Registering hash for export ${exportArtifactId} on Polygon Amoy... // TODO: Phase 2`);
  await new Promise(r => setTimeout(r, 1000));
  
  return {
    txHash: "0xdummytransactionhash"
  };
}
