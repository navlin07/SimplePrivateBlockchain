/* ===== SHA256 with Crypto-js ===============================
|  Learn more: Crypto-js: https://github.com/brix/crypto-js  |
|  =========================================================*/
const SHA256 = require('crypto-js/sha256');
const level = require('level');
const chainDB = './chaindata';
const db = level(chainDB);
// function for adding two numbers.
const addArray = (a, b) => a + b;

/* ===== Block Class ==============================
|  Class with a constructor for block          |
|  ===============================================*/

class Block {
    constructor(data) {
        this.hash = "",
            this.height = 0,
            this.body = data,
            this.time = 0,
            this.previousBlockHash = ""
    }
}

/* ===== Blockchain Class ==========================
|  Class with a constructor for new blockchain    |
|  ================================================*/

class Blockchain {
    constructor() {
        this.generateGenesisBlock();
    }

    // Add new block
    addBlock(newBlock) {
        return new Promise((resolve, reject) => {
            this.getBlockHeight().then((height) => {
                    newBlock.height = height;
                    // UTC timestamp
                    newBlock.time = new Date().getTime().toString().slice(0, -3);
                    // previous block hash
                    if (newBlock.height > 0) {
                        this.getBlock(height - 1).then((block) => {
                            console.log('adding new block with previous hash of block: ' + JSON.stringify(block));
                            newBlock.previousBlockHash = block.hash;
                            // Block hash with SHA256 using newBlock and converting to a string
                            newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
                            // Adding block object to db
                            this.addDataToLevelDB(newBlock.height, newBlock).then((result) => {
                                console.log("Result: " + result);
                                resolve(result);
                            }).catch(error => {
                                console.log("addBlock Error" + error);
                            });
                        }).catch(error => {
                            reject(error);
                            console.log("addBlock Error in getBlock at addBlock with newBlock.height " + newBlock.height + error);
                        });
                    }
                })
                .catch(error => {
                    console.log("addBlock Error in AddBlock" + error);
                    reject(error);
                });
        });
        // Block height
    }

    // Create Genesis Block
    generateGenesisBlock() {
        console.log("Checking if genesis already exists");
        this.getBlockHeight().then((height) => {
            if (height === 0) {
                console.log("Genesis did not exists");
                let genesisBlock = new Block("Genesis block");
                genesisBlock.height = 0;
                genesisBlock.time = new Date().getTime().toString().slice(0, -3);
                genesisBlock.hash = SHA256(JSON.stringify(genesisBlock)).toString();
                this.addDataToLevelDB(0, genesisBlock).then((result) => {
                    console.log("Genesis Result: " + result);
                }).catch(error => {
                    console.log("Genesis addBlock Error" + error);
                });
            }
        }).catch((err) => {
            console.log("Genesis: " + err);
        });
    }

    // Get block height
    getBlockHeight() {
        return new Promise(function(resolve, reject) {
            let i = 0;
            db.createReadStream()
                .on('data', function() {
                    i++;
                })
                .on('error', function() {
                    reject("BlockHeight Could not retrieve chain length");
                })
                .on('close', function() {
                    resolve(i);
                });
        });
    }

    // get block
    getBlock(blockHeight) {
        return new Promise((resolve, reject) => {
            db.get(blockHeight, function(err, value) {
                if (err) {
                    console.log('getBlock Not found!', err);
                    reject(err);
                };
                // return object as a single string
                resolve(JSON.parse(value));
            });
        });
    }

    // modifyBlock in blockchain
    modifyBlock(blockHeight, data) {
        return new Promise((resolve, reject) => {
            // get block object
            this.getBlock(blockHeight).then((block) => {
                block.body = data;
                this.addDataToLevelDB(blockHeight, block).then((result) => {
                    console.log("Result: " + result);
                    resolve(result);
                }).catch(error => {
                    console.log("Error modifyBlock" + error);
                    reject(error);
                });
            }).catch((err) => {
                console.log("Error in getBlock at ValidateBlock() with Block " + err);
                reject(err);
            });
        });
    }

    // validate block
    validateBlock(blockHeight) {
        return new Promise((resolve, reject) => {
            // get block object
            this.getBlock(blockHeight).then((block) => {
                // get block hash
                let blockHash = block.hash;
                // remove block hash to test block integrity
                block.hash = '';
                // generate block hash
                let validBlockHash = SHA256(JSON.stringify(block)).toString();
                // Compare
                if (blockHash === validBlockHash) {
                    console.log("Valid");
                    resolve(true);
                } else {
                    console.log('Block #' + blockHeight + ' invalid hash:\n' + blockHash + '<>' + validBlockHash);
                    resolve(false);
                }
            }).catch((err) => {
                console.log("Error in getBlock at ValidateBlock() with Block " + err);
                reject(err);
            });
        });
    }

    validateBlockInChain(height, lastIteration) {
        return new Promise((resolve, reject) => {
            this.validateBlock(height).then((result) => {
                console.log("validateBlock: " + result);
                if (!result) {
                    console.log("validateBlockInChain no valid");
                    resolve(1);
                } else {
                    // get current Block
                    if (height < lastIteration) {
                        this.getBlock(height).then((block) => {
                            let blockHash = block.hash;
                            this.getBlock(height + 1).then((blockNext) => {
                                let previousHash = blockNext.previousBlockHash;
                                if (blockHash !== previousHash) {
                                    console.log("validateBlockInChain no valid");
                                    resolve(1);
                                } else {
                                    console.log("validateBlockInChain valid");
                                    resolve(0);
                                }
                            }).catch((err) => {
                                console.log("Error in getNextBlock" + err);
                                reject(err);
                            });
                        }).catch((err) => {
                            console.log("Error in getBlock" + err);
                            reject(err);
                        });
                    } else {
                        resolve(0);
                    }
                }
            }).catch((err) => {
                console.log("Error validating block: " + err);
                reject(err);
            });
        });
    }

    // Validate blockchain
    validateChain() {
        return new Promise((resolve, reject) => {
            let counter = 0;
            this.getBlockHeight().then((height) => {
                var lastIteration = height - 1;
                var promiseArray = [];
                for (var i = 0; i < height; i++) {
                    // validate block
                    promiseArray.push(this.validateBlockInChain(i, lastIteration));
                }
                Promise.all(promiseArray).then(values => {
                    console.log("Then Promise all");
                    console.log(values);
                    counter = values.reduce(addArray);
                    if (counter > 0) {
                        console.log('Block errors = ' + counter);
                        console.log('Invalid chain');
                        resolve('Block errors = ' + counter);
                    } else {
                        console.log('No errors detected');
                        resolve('No errors detected');
                    }
                }).catch(reason => {
                    console.log(reason);
                    reject(reason);
                });
            }).catch((err) => {
                console.log("Error obtaining height: " + err);
                reject(err);
            });

        });
    }

    // Get data from levelDB with key
    getLevelDBData(key) {
        return new Promise((resolve, reject) => {
            db.get(key, function(err, value) {
                if (err) {
                    console.log('getLevelData Not found!', err);
                    reject(err);
                };
                resolve(value);
            })
        });
    }

    // Add data to levelDB with value
    addDataToLevelDB(height, newBlock) {
        return new Promise(function(resolve, reject) {
            let i = 0;
            db.createReadStream().on('data', function(data) {
                i++;
            }).on('error', function(err) {
                reject('Unable to read data stream!', err);
            }).on('close', function() {
                addLevelDBData(height, JSON.stringify(newBlock)).then((result) => {
                    console.log("Block added");
                    resolve(result)
                }).catch(error => {
                    console.log("addBlock Error" + error);
                    reject('Unable to addBlock!', error);
                });
            });
        });
    }
}

// Add data to levelDB with key/value pair
function addLevelDBData(key, value) {
    return new Promise((resolve, reject) => {
        db.put(key, value, function(err) {
            if (err) {
                console.log('Block ' + key + ' submission failed', err);
                reject(err);
            };
            resolve(value);
        });
    });
}

let blockchain = new Blockchain();

(function theLoop(i) {
    setTimeout(function() {
        let blockTest = new Block("Test Block - " + (i + 1));
        blockchain.addBlock(blockTest).then((result) => {
            i++;
            if (i < 10) theLoop(i);
        }).catch(error => {
            console.log("addBlock Error in getBlock loop" + error);
        });
    }, 1000);
})(0);