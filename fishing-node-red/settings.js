module.exports = {
  flowFile: 'flows.json',
  functionGlobalContext: { mongodb: require('/opt/fishing/node_modules/mongodb'), csvParse: require('/opt/fishing/node_modules/csv-parse/dist/cjs/sync.cjs'), crypto: require('crypto') },
  editorTheme: { projects: { enabled: false } }
};
