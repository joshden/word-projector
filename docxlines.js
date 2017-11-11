const fs = require('fs');
const parseString = require('xml2js').parseString;
const jszip = require('jszip');


fs.readFile("data/#1-25.docx", function(err, data) {
    if (err) throw err;
    jszip.loadAsync(data).then(zip => {
        const file = zip.file('word/document.xml');
        file.async('string').then(data => {
            processXml(data);
        });
    });
});

// fs.readFile('data/#1-25/word/document.xml', 'utf8', function(err, data) {
//     if (err) throw err;
//     processXml(data);
// });

function processXml(data) {
    fs.readFile('data/#1-25/word/document.xml', 'utf8', function(err, data) {
        if (err) throw err;
        parseString(data, {/*ignoreAttrs: true,*/ preserveChildrenOrder: true, explicitChildren: true}, function (err, result) {
            if (err) throw err;
            const output = [];
            const paragraphs = result['w:document']['w:body'][0]['w:p']/*.slice(0,20)*/;

            const spacings = new Set();
            
            // console.log(JSON.stringify(paragraphs, null, 2));

            let wasPreviousParagraphZeroSpacingAfter = false;

            paragraphs.forEach(p => {
                let outputLine = null;
                function addLine() {
                    outputLine = [];
                    output.push(outputLine);
                }
                addLine();

                let isParagraphZeroSpacingBefore = false;
                let isParagraphZeroSpacingAfter = false;
                if (p.hasOwnProperty('w:pPr')) {
                    p['w:pPr'].forEach(paraProp => {
                        if (paraProp.hasOwnProperty('w:spacing')) {
                            if (paraProp['w:spacing'].length !== 1) {
                                throw 'Expected 1 w:spacing, but found ' + paraProp['w:spacing'].length;
                            }
                            paraProp['w:spacing'].forEach(spacing => {
                                if (spacing.$['w:before'] === '0') {
                                    isParagraphZeroSpacingBefore = true;
                                }
                                if (spacing.$['w:after'] === '0') {
                                    isParagraphZeroSpacingAfter = true;
                                    if (! spacing.$.hasOwnProperty('w:before')) {
                                        isParagraphZeroSpacingBefore = true;
                                    }
                                }
                                spacings.add(JSON.stringify(spacing['$']));
                            });
                        }
                    });
                }

                if (!isParagraphZeroSpacingBefore && wasPreviousParagraphZeroSpacingAfter) {
                    addLine();
                }

                if (p.hasOwnProperty('w:r')) {
                    p['w:r'].forEach(run => {
                        if (run.hasOwnProperty('$$')) {
                            run['$$'].forEach(el => {
                                if (el['#name'] === 'w:br') {
                                    addLine();
                                }
                                else if (el['#name'] === 'w:rPr' || el['#name'] === 'w:lastRenderedPageBreak') {
                                    // ignore this text property
                                }
                                else if (el['#name'] === 'w:t') {
                                    if (el.hasOwnProperty('_')) {
                                        outputLine.push(el._);
                                    }
                                }
                                else {
                                    throw 'Unexpected tag ' + el['#name'];
                                }
                            });
                        }
                    })
                }

                if (! isParagraphZeroSpacingAfter) {
                    addLine();
                }
                wasPreviousParagraphZeroSpacingAfter = isParagraphZeroSpacingAfter;
            });

            const lines = output
                .map(segments => segments.join(''))
                .reduce((accum, line) => accum.concat(line.split(/ {70,}/)), []);

            console.log(JSON.stringify(lines, null, 2));
            // console.log(spacings);
        });
    });
}