import xml2js from 'xml2js';
import jszip from 'jszip';

const { parseString } = xml2js;


export default function getDocxTextLines(filePath: string, data: Buffer | Promise<Buffer>): Promise<string[]> {
    return new Promise((resolve, reject) => {
        jszip.loadAsync(data as any).then(zip => {
            const file = zip.file('word/document.xml');
            file.async('text').then(data => { // was string
                processXml(filePath, data, resolve, reject);
            });
        }).catch(err => console.error(`Error loading docx data for ${filePath}`, err));
    });
}

// fs.readFile('data/#1-25/word/document.xml', 'utf8', function(err, data) {
//     if (err) throw err;
//     processXml(data);
// });

function processXml(filePath: string, data: string, resolve: (value: string[]) => void, reject: (reason?: any) => void) {
    parseString(data, {/*ignoreAttrs: true,*/ preserveChildrenOrder: true, explicitChildren: true}, function (err, result) {
        if (err) {
            reject(err);
        }
        const output: string[][] = [];
        const paragraphs = result['w:document']['w:body'][0]['w:p']/*.slice(0,20)*/;

        const spacings = new Set();
        
        // console.log(JSON.stringify(paragraphs, null, 2));

        let wasPreviousParagraphZeroSpacingAfter = false;
        let wasPreviousParagraphStyleNormalWeb = false;
        let wasPreviousParagraphSpacingAfterDefined = false;

        paragraphs.forEach((p: any) => {
            let outputLine: string[] = [];
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
                p['w:pPr'].forEach((paraProp: any) => {
                    if (paraProp.hasOwnProperty('w:pStyle')) {
                        paraProp['w:pStyle'].forEach((pStyle: any) => {
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
                        paraProp['w:spacing'].forEach((spacing: any) => {
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

            runs.forEach((run: any) => {
                if (run.hasOwnProperty('$$')) {
                    run['$$'].forEach((el: any) => {
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
            .reduce((accum, line) => accum.concat(line.split(/ {70,}/)), [] as string[]);

        resolve(lines);
        // console.log(JSON.stringify(lines, null, 2));
        // console.log(spacings);
    });
}

function getAllRuns(obj: any, runs = [] as any[]) {
    if (obj["#name"] === 'w:r') {
        runs.push(obj)
    }

    if (obj.$$) {
        obj.$$.forEach((el: any) => getAllRuns(el, runs))
    }

    return runs;
}