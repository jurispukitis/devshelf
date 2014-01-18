var fs = require('fs')
    , colors = require('colors')
    , path = require('path')
    , md5 = require('MD5')
    , sh = require("shorthash")
    , extend = require('extend');


/**
 * Extend srcInput arcicles data with extendedInput data (for localization data merge)
 * @param {Object} srcInput
 * @param {Object} extenderInput
 */
var extendArticlesData = function(srcInput, extenderInput){
    var src = JSON.parse(JSON.stringify(srcInput)), //Cloning objects to isolate from main
        extender = JSON.parse(JSON.stringify(extenderInput));

    for (var cat in extender) {
        var catObj = extender[cat];

        for (var tag in catObj) {
            var tagArr = catObj[tag],
                srcTagArr = src[cat][tag] || [];

            if (srcTagArr.length === 0) {
                src[cat][tag] = [];
            }

            src[cat][tag] = srcTagArr.concat(tagArr);
        }
    }

    return src;
};

/**
 * Generate JSON file with all articles data
 * @param {String} targetDir
 * @param {String} lang
 */
var prepareJSON = function(targetDir, lang) {
    //Generating output data with all articles info
    var language = lang,
        localizationEnabled = typeof language !== 'undefined',

        dir = localizationEnabled ? targetDir + language + '/' : targetDir,

        outputJSON = {},

        langDefault = global.opts.langDefault,
        articlesDataOutputDir = global.opts.articlesDataOutputDir,

        articlesDataFile = global.opts.articlesDataFile,
        articlesDataLangFile = global.opts.articlesDataLangFile;

    fs.readdir(dir, function(err, files){
        var jsonFilesArr = [];

        //Take only json files
        files.map(function(file){
            var fileExtension = file.split('.');

            fileExtension = fileExtension[fileExtension.length -1];
            fileExtension.toLowerCase();

            if (fileExtension === 'json'){
                jsonFilesArr.push(file);
            }
        });

        var jsonFileCount = jsonFilesArr.length;

        var jsonFileQueue = 0;
        jsonFilesArr.map(function(file){
            var fileName = path.basename(file, ".json");
            var currentFile = JSON.parse(fs.readFileSync(dir+file, "utf8"));

            //Processing json data to add custom objects to it
            for (tag in currentFile) {
                var targetDataArr = currentFile[tag];

                var i=0;
                while(i<targetDataArr.length){
                    var targetObj = targetDataArr[i],
                        targetEmail = targetObj["author-mail"],
                        targetUrl = targetObj["url"];

                    //Generating email md5 hash
                    if(typeof targetEmail === 'string') {
                        var authorMailHash = md5(targetEmail);

                        targetObj["author-mail-hash"] = authorMailHash;
                    }

                    //Generating unique ID by hash
                    if(typeof targetUrl === 'string') {
                        var targetID = targetObj["id"];

                        if (typeof targetID !== 'string') {
                            var authorUrlHash = sh.unique(targetUrl);

                            targetObj["id"] = authorUrlHash;
                        }
                    }

                    i++;
                }
            }

            outputJSON[fileName] = extend(currentFile);
            jsonFileQueue++;

            //When all fiels scanned
            if (jsonFileQueue === jsonFileCount) {
                var finalJSON = outputJSON;

                //If localized, merge with main JSON
                if (localizationEnabled) {

                    //Update JSON data
                    var defaultLangJSON = global.articlesData[langDefault];

                    finalJSON = extendArticlesData(defaultLangJSON, outputJSON);

                    global.articlesData[language] = outputJSON;
                }

                global.articlesData[langDefault] = finalJSON || {};

                // function for write json file
                var generateJSON = function(data, dir, fileName) {
                    var JSONformat = null;

                    if (global.MODE === 'development') {
                        JSONformat = 4;
                    }

                    fs.writeFile(dir + fileName, JSON.stringify(data, null, JSONformat), function (err) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log("Generating Articles data in ".green + dir.green + fileName.green + ": DONE".green);
                        }
                    });
                };

                (function(fullJSON, onlyLang) {
                    var outputDir = global.appDir+articlesDataOutputDir;

                    if (localizationEnabled) {
                        outputDir = global.appDir+articlesDataOutputDir+language+'/';
                    }

                    var processJSON = function(){
                        generateJSON(fullJSON, outputDir, articlesDataFile);

                        if (localizationEnabled) {
                            generateJSON(onlyLang, outputDir, articlesDataLangFile);
                        }
                    };

                    //Prepare output folder and write file
                    fs.readdir(outputDir,function(e){
                        if(!e || (e && e.code === 'EEXIST')){
                            processJSON();
                        } else if (e.code === 'ENOENT') {
                            fs.mkdir(outputDir);
                            processJSON();
                        } else {
                            console.log(e);
                        }
                    });
                })(finalJSON, outputJSON);
            }
        });
    });
};

var generateData = function() {
    prepareJSON(global.appDir + '/articles-data/');
    prepareJSON(global.appDir + '/articles-data/', 'ru');
};

/* Export */
module.exports = {
    generateData: function(){
        generateData();
    }
};