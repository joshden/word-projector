const fs = require('fs');
const parseString = require('xml2js').parseString;
const jszip = require('jszip');


module.exports = function getDocxTextLines(filePath, indicateIfLineHasAnyBold = false) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, function(err, data) {
            if (err) {
                reject(err);
            }
            jszip.loadAsync(data).then(zip => {
                const file = zip.file('word/document.xml');
                file.async('string').then(data => {
                    processXml(data, resolve, reject, indicateIfLineHasAnyBold);
                });
            });
        });
    });
}

// fs.readFile('data/#1-25/word/document.xml', 'utf8', function(err, data) {
//     if (err) throw err;
//     processXml(data);
// });

function processXml(data, resolve, reject, indicateIfLineHasAnyBold) {
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
            let currentLine = null;
            let currentSegments = null;
            function addLine() {
                currentSegments = [];
                currentLine = {segments: currentSegments};
                output.push(currentLine);
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

                    maybeSetLineBoldIfRunPr(indicateIfLineHasAnyBold, paraProp, currentLine);
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
                                currentSegments.push(el._);
                            }
                            else if (el.$ && el.$['xml:space'] === 'preserve') {
                                // console.log(el);
                                currentSegments.push(' ');
                            }
                        }
                        else {
                            throw 'Unexpected tag ' + el['#name'];
                        }
                    });
                }

                maybeSetLineBoldIfRunPr(indicateIfLineHasAnyBold, run, currentLine);
            });

            if (! isParagraphZeroSpacingAfter) {
                addLine();
            }
            wasPreviousParagraphZeroSpacingAfter = isParagraphZeroSpacingAfter;
            wasPreviousParagraphSpacingAfterDefined = isParagraphSpacingAfterDefined;
            wasPreviousParagraphStyleNormalWeb = isParagraphStyleNormalWeb;
        });

        const lines = output
            .map(line => {
                line.text = line.segments.join('');
                delete line.segments;
                return line;
            })
            .reduce((accum, origLine) => {
                const longLineBreaks = origLine.text.split(/ {70,}/);
                longLineBreaks.forEach(brokenLine => {
                    const newLine = JSON.parse(JSON.stringify(origLine));
                    newLine.text = brokenLine;
                    accum.push(newLine);
                });
                return accum;
            }, []);

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

function maybeSetLineBoldIfRunPr(indicateIfLineHasAnyBold, paraPropOrRunEl, currentLine) {
    if (indicateIfLineHasAnyBold && paraPropOrRunEl.hasOwnProperty('w:rPr')) {
        paraPropOrRunEl['w:rPr'].forEach(rPr => {
            if (rPr.hasOwnProperty('w:b')) {
                currentLine.hasAnyBold = true;
            }
        });
    }
}