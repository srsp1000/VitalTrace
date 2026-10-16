const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const powerBiDir = path.join(rootDir, 'powerbi');
const stagingDir = path.join(rootDir, 'node_modules', '.tmp_pbix_staging');

// Clean staging dir
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(path.join(stagingDir, 'Report'), { recursive: true });

// 1. [Content_Types].xml
const contentTypesXml = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="" />
  <Override PartName="/Settings" ContentType="" />
  <Override PartName="/Version" ContentType="" />
  <Override PartName="/DataModelSchema" ContentType="" />
  <Override PartName="/Report/Layout" ContentType="" />
  <Override PartName="/DiagramLayout" ContentType="" />
</Types>`;
fs.writeFileSync(path.join(stagingDir, '[Content_Types].xml'), contentTypesXml, 'utf-8');

// 2. Version (Must be UTF-16LE for PowerBIPackager)
fs.writeFileSync(path.join(stagingDir, 'Version'), Buffer.from('1.28', 'utf16le'));

// 3. Settings
const settingsJson = JSON.stringify({
  version: "1.0",
  model: {
    queryEvaluationTimeout: "PT1H"
  }
});
fs.writeFileSync(path.join(stagingDir, 'Settings'), Buffer.from(settingsJson, 'utf16le'));

// 4. DataModelSchema (UTF-16LE)
const modelBimPath = path.join(powerBiDir, 'VitalTrace_Analytics.SemanticModel', 'model.bim');
const modelBim = fs.readFileSync(modelBimPath, 'utf-8');
fs.writeFileSync(path.join(stagingDir, 'DataModelSchema'), Buffer.from(modelBim, 'utf16le'));

// 5. Report/Layout (UTF-16LE)
const reportJsonPath = path.join(powerBiDir, 'VitalTrace_Analytics.Report', 'report.json');
const reportJson = fs.readFileSync(reportJsonPath, 'utf-8');
fs.writeFileSync(path.join(stagingDir, 'Report', 'Layout'), Buffer.from(reportJson, 'utf16le'));

// 6. DiagramLayout
const diagramLayout = JSON.stringify({
  version: "1.1.0",
  diagrams: [
    {
      ordinal: 0,
      scrollPosition: { x: 0, y: 0 },
      nodes: [
        { location: { x: 100, y: 100 }, nodeIndex: "dim_documents" },
        { location: { x: 400, y: 100 }, nodeIndex: "fact_extraction_runs" },
        { location: { x: 400, y: 350 }, nodeIndex: "fact_observations" },
        { location: { x: 400, y: 600 }, nodeIndex: "fact_validation_issues" },
        { location: { x: 700, y: 350 }, nodeIndex: "dim_analytes" },
        { location: { x: 100, y: 350 }, nodeIndex: "dim_calendar" }
      ],
      zoomValue: 100
    }
  ]
});
fs.writeFileSync(path.join(stagingDir, 'DiagramLayout'), Buffer.from(diagramLayout, 'utf16le'));

// 7. SecurityBindings
fs.writeFileSync(path.join(stagingDir, 'SecurityBindings'), Buffer.alloc(0));

// 8. Compress stagingDir to powerbi/VitalTrace_Analytics.pbix using PowerShell Compress-Archive
const targetZip = path.join(powerBiDir, 'VitalTrace_Analytics.zip');
const targetPbix = path.join(powerBiDir, 'VitalTrace_Analytics.pbix');
if (fs.existsSync(targetZip)) fs.unlinkSync(targetZip);
if (fs.existsSync(targetPbix)) fs.unlinkSync(targetPbix);

const stagingWildcard = path.join(stagingDir, '*');
const psCommand = `powershell -Command "Compress-Archive -Path '${stagingWildcard}' -DestinationPath '${targetZip}' -Force"`;
console.log('Packaging PBIX archive...');
execSync(psCommand, { stdio: 'inherit' });

// Rename .zip to .pbix
fs.renameSync(targetZip, targetPbix);
console.log('Successfully created:', targetPbix);

// Clean staging dir
fs.rmSync(stagingDir, { recursive: true, force: true });
