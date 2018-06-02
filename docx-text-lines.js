const parseString = require('xml2js').parseString;
const jszip = require('jszip');


module.exports = function getDocxTextLines(filePath, data) {
    return new Promise((resolve, reject) => {
        jszip.loadAsync(data).then(zip => {
            const file = zip.file('word/document.xml');
            file.async('string').then(data => {
                processXml(filePath, data, resolve, reject);
            });
        }).catch(err => console.error(`Error loading docx data for ${filePath}`, err));
    });
}

// fs.readFile('data/#1-25/word/document.xml', 'utf8', function(err, data) {
//     if (err) throw err;
//     processXml(data);
// });

function processXml(filePath, data, resolve, reject) {
    parseString(data, {/*ignoreAttrs: true,*/ preserveChildrenOrder: true, explicitChildren: true}, function (err, result) {
        if (err) {
            reject(err);
        }
        const output = [];
        const paragraphs = result['w:document']['w:body'][0]['w:p']/*.slice(0,20)*/;

        const spacings = new Set();
        
        // console.log(JSON.stringify(paragraphs, null, 2));

        let wasPreviousParagraphZeroSpacingAfter = false;
        let wasPreviousParagraphStyleNormalWeb = false;
        let wasPreviousParagraphSpacingAfterDefined = false;

        paragraphs.forEach(p => {
            let outputLine = null;
            function addLine() {
                outputLine = [];
                output.push(outputLine);
            }
            addLine();

            let isParagraphZeroSpacingBefore = true;
            let isParagraphZeroSpacingAfter = true;
            let isParagraphSpacingAfterDefined = false;
            let isParagraphStyleNormalWeb = false;
            let isParagraphLineSpacingSpecified = false;
            if (p.hasOwnProperty('w:pPr')) {
                p['w:pPr'].forEach(paraProp => {
                    if (paraProp.hasOwnProperty('w:pStyle')) {
                        paraProp['w:pStyle'].forEach(pStyle => {
                            isParagraphStyleNormalWeb = pStyle.$['w:val'] === 'NormalWeb';
                            if (isParagraphStyleNormalWeb) {
                                isParagraphZeroSpacingBefore = false;
                                isParagraphZeroSpacingAfter = false;
                            }
                        });
                    }

                    if (paraProp.hasOwnProperty('w:spacing')) {
                        if (paraProp['w:spacing'].length !== 1) {
                            throw 'Expected 1 w:spacing, but found ' + paraProp['w:spacing'].length;
                        }
                        paraProp['w:spacing'].forEach(spacing => {
                            if (spacing.$['w:before'] === '0') {
                                isParagraphZeroSpacingBefore = true;
                            }
                            else if (spacing.$['w:before'] === '100') {
                                isParagraphZeroSpacingBefore = false;
                            }
                            isParagraphSpacingAfterDefined = spacing.$.hasOwnProperty('w:after');
                            if (spacing.$['w:after'] === '0') {
                                isParagraphZeroSpacingAfter = true;
                                if (! spacing.$.hasOwnProperty('w:before')) {
                                    isParagraphZeroSpacingBefore = true;
                                }
                            }
                            else if (spacing.$['w:after'] === '100') {
                                isParagraphZeroSpacingAfter = false;
                            }
                            isParagraphLineSpacingSpecified = spacing.$.hasOwnProperty('w:line');
                            spacings.add(JSON.stringify(spacing['$']));
                        });
                    }
                });
            }

            if (!isParagraphZeroSpacingBefore && wasPreviousParagraphZeroSpacingAfter) {
                addLine();
            }
            else if (isParagraphSpacingAfterDefined && ! wasPreviousParagraphSpacingAfterDefined && ! isParagraphStyleNormalWeb && ! wasPreviousParagraphStyleNormalWeb && ! isParagraphLineSpacingSpecified) {
                addLine();
            }

            const runs = getAllRuns(p);
            // console.log(JSON.stringify(runs, null, 2));

            runs.forEach(run => {
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
                                // console.log(`[${el._}]`);
                                outputLine.push(el._);
                            }
                            else if (el.$ && el.$['xml:space'] === 'preserve') {
                                // console.log(el);
                                outputLine.push(' ');
                            }
                        }
                        else if (el['#name'] === 'w:tab') {
                            outputLine.push('   ');
                        }
                        else {
                            throw `Unexpected tag ${el['#name']} in file ${filePath}`;
                        }
                    });
                }
            });

            if (! isParagraphZeroSpacingAfter) {
                addLine();
            }
            wasPreviousParagraphZeroSpacingAfter = isParagraphZeroSpacingAfter;
            wasPreviousParagraphSpacingAfterDefined = isParagraphSpacingAfterDefined;
            wasPreviousParagraphStyleNormalWeb = isParagraphStyleNormalWeb;
        });

        const lines = output
            .map(segments => segments.join(''))
            .reduce((accum, line) => accum.concat(line.split(/ {70,}/)), []);

        resolve(lines);
        // console.log(JSON.stringify(lines, null, 2));
        // console.log(spacings);
    });
}

function getAllRuns(obj, runs = []) {
    if (obj["#name"] === 'w:r') {
        runs.push(obj)
    }

    if (obj.$$) {
        obj.$$.forEach(el => getAllRuns(el, runs))
    }

    return runs;
}