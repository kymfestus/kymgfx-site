const fs=require('node:fs'),vm=require('node:vm');
module.exports=file=>{const module={exports:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,Date,Intl,URL,encodeURIComponent,AbortController},{filename:file});return module.exports;};
