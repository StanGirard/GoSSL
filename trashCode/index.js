var csv = require('csv-parser')
var fs = require('fs')
var es = require('event-stream')
var data = []
const sslCertificate = require('get-ssl-certificate')
var error = 0;
var success = 0;
var encrypt = 0;
var inserted = 0;
var BLOCK_LIMIT = 0;
var queryErrorNb = 0
var sslrunning = 0;
var sqlrunning = 0;
var paused = false;
const mysql = require('mysql');


// First you need to create a connection to the db host: 'database.cppynzdwfotc.eu-west-3.rds.amazonaws.com',
const con = mysql.createConnection({
    host: '139.59.179.77',
    user: 'admin',
    password: 'Stanley78!',
});

con.connect((err) => {
    if (err) {
        console.log('Error connecting to Db');
        throw err;
        return;
    }
    console.log('Connection established');

    /*var sql = "CREATE TABLE IF NOT EXISTS `Certificates`.`certificate` (`id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY, `domain` VARCHAR(255) NULL, `certificate` VARCHAR(16000) NULL);";
    con.query(sql, function(err, result) {
        if (err) throw err;
        console.log("Table created");
    });*/
});
var start = new Date()
var calc = new Date()
const streamData = fs.createReadStream('top10milliondomains.csv')
    .pipe(es.split())
    .on('data', async function(row) {

        if (BLOCK_LIMIT > 10000 && paused == false) {
            streamData.pause()
            paused = true;
        }
        BLOCK_LIMIT += 1;
        sslrunning += 1;
        return sslCertificate.get(row.split(',')[1].replace('"', '').replace('"', ''), 250, 443, 'https:').then(async function(certificate) {
            var sql = "INSERT INTO Certificates.cert(company, domain, issuer, pubkey, valid_from, valid_to, fingerprint, fingerprint256) VALUES (" + con.escape(certificate.subject.O) + ", " + con.escape(row.split(',')[1].replace('"', '').replace('"', '')) + ", " + con.escape(certificate.issuer.O) + ", " + con.escape(JSON.stringify(certificate.pubkey)) + ", " + con.escape(certificate.valid_from) + ", " + con.escape(certificate.valid_to) + ", " + con.escape(certificate.fingerprint) + ", " + con.escape(certificate.fingerprint256) + ");";
            sqlrunning += 1
            sslrunning -= 1
            return await con.query(sql, async function(err, result) {
                sqlrunning -= 1;
                BLOCK_LIMIT -= 1;
                if (err) {

                    queryErrorNb += 1;
                    BLOCK_LIMIT -= 1;
                    if (BLOCK_LIMIT <= 2000 && paused == true) {
                        paused = false;
                        streamData.resume()

                    }

                    error += 1


                };
                inserted += 1
                if (BLOCK_LIMIT <= 2000 && paused == true) {
                    paused = false;
                    streamData.resume()

                }


                if (BLOCK_LIMIT % 100 == 0) {
                    const used = process.memoryUsage();
                    var max = 0;
                    for (let key in used) {

                        max += Math.round(used[key] / 1024 / 1024);
                    }

                    console.log("Block: " + BLOCK_LIMIT + ", Inserted: " + inserted + ", Query Error: " + queryErrorNb + ' Error: ' + error + " ," + max + 'mb');

                    var end = new Date()
                    var time = end - calc
                    calc = end
                    console.log(BLOCK_LIMIT + " , Time: " + time + "ms")
                    console.log(sslrunning)
                    console.log(sqlrunning)
                }

                if (certificate.issuer.O == "Let's Encrypt") {
                    encrypt += 1;
                }
                success += 1;
            })


        }).catch(function(erro) {
            //console.error(erro);
            BLOCK_LIMIT -= 1;
            sslrunning -= 1;
            sqlrunning -= 1;
            if (BLOCK_LIMIT <= 2000 && paused == true) {
                paused = false;
                streamData.resume()

            }

            error += 1;
            return;
        });

    })
    .on('end', function() {
        console.log('Data loaded')
        var end = new Date() - start
        var TPI = Math.floor(end / inserted)
        console.log(TPI + "ms")
    })
process.on('SIGINT', function() {
    console.log("Caught interrupt signal");
    console.log("Success: " + success)
    console.log("Error: ", error)
    console.log("Encrypt:", encrypt)
    console.log("Inserted:", inserted)
    var end = new Date() - start
    var TPI = Math.floor(end / inserted)
    console.log(TPI + "ms")
    process.exit();
});