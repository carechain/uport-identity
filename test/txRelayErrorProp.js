const lightwallet = require('eth-lightwallet')
const evm_increaseTime = require('./evmIncreaseTime.js')
const MetaTxRelay = artifacts.require('TxRelay')
const RunOutOfGas = artifacts.require('RunOutOfGas')
const Promise = require('bluebird')
const compareCode = require('./compareCode')
const solsha3 = require('solidity-sha3').default
const leftPad = require('left-pad')

const LOG_NUMBER_1 = 1234
const LOG_NUMBER_2 = 2345

const userTimeLock = 100;
const adminTimeLock = 1000;
const adminRate = 200;

//NOTE: All references to identityManager in this contract are to a metaIdentityManager

const zero = "0000000000000000000000000000000000000000000000000000000000000000"

function enc(funName, types, params) {
  return '0x' + lightwallet.txutils._encodeFunctionTxData(funName, types, params)
}

//Returns random number in [1, 99]
function getRandomNumber() { //Thanks Oed :~)
  return Math.floor(Math.random() * (100 - 1)) + 1;
}

//Left packs a (hex) string. Should probably use leftpad
function pad(n) {
  assert.equal(typeof(n), 'string', "Passed in a non string")
  let data
  if (n.startsWith("0x")) {
    data = '0x' + leftPad(n.slice(2), '64', '0')
    assert.equal(data.length, 66, "packed incorrectly")
    return data;
  } else {
    data = '0x' + leftPad(n, '64', '0')
    assert.equal(data.length, 66, "packed incorrectly")
    return data;
  }
}

async function signPayload(signingAddr, sendingAddr, txRelay, destinationAddress, functionName,
                     functionTypes, functionParams, lw, keyFromPw)
{
   if (functionTypes.length !== functionParams.length) {
     return //should throw error
   }
   if (typeof(functionName) !== 'string') {
     return //should throw error
   }
   let nonce
   let blockTimeout
   let data
   let hashInput
   let hash
   let sig
   let retVal = {}
   data = enc(functionName, functionTypes, functionParams)

   nonce = await txRelay.getNonce.call(signingAddr)
   //Tight packing, as Solidity sha3 does
   hashInput = txRelay.address + pad(nonce.toString('16')).slice(2)
               + destinationAddress.slice(2) + data.slice(2) + sendingAddr.slice(2)
   hash = solsha3(hashInput)
   sig = lightwallet.signing.signMsgHash(lw, keyFromPw, hash, signingAddr)
   retVal.r = '0x'+sig.r.toString('hex')
   retVal.s = '0x'+sig.s.toString('hex')
   retVal.v = sig.v //Q: Why is this not converted to hex?
   retVal.data = data
   retVal.hash = hash
   retVal.nonce = nonce
   retVal.dest = destinationAddress
   return retVal
}



contract('TxRelay', (accounts) => {
  let txRelay
  let runOutOfGas
  let user1
  let user2
  let user3
  let user4
  let sender

  let lw
  let keyFromPw

  let data
  let types
  let params
  let newData
  let res
  let regData
  let p
  let errorThrown = false;

  beforeEach((done) => {
    let seed = "pull rent tower word science patrol economy legal yellow kit frequent fat"

    lightwallet.keystore.createVault(
    {hdPathString: "m/44'/60'/0'/0",
     seedPhrase: seed,
     password: "test",
     salt: "testsalt"
    },
    function (err, keystore) {

      lw = keystore
      lw.keyFromPassword("test", async function(e,k) {
        keyFromPw = k

        lw.generateNewAddress(keyFromPw, 10)
        let acct = lw.getAddresses()

        user1 = '0x'+acct[0]
        nobody = '0x'+acct[1] // has no authority
        user2 = '0x'+acct[2]
        user3 = '0x'+acct[3]
        user4 = '0x'+acct[4]
        recoveryKey = '0x'+acct[8]
        recoveryKey2 = '0x'+acct[9]

        sender = accounts[0]
        notSender = accounts[1]
        regularUser = accounts[2]

        errorThrown = false

        txRelay = await MetaTxRelay.new()
        runOutOfGas = await RunOutOfGas.new()
        done()
      })
    })
  })

  describe("Nonce Updating", () => {
    it('Should update nonce even if subcall runs out of gas', async function() {
      types = ['address']
      params = [user1]
      p = await signPayload(user1, sender, txRelay, runOutOfGas.address, 'testOOG',
                            types, params, lw, keyFromPw)

      let nonce1 = await txRelay.getNonce.call(user1)
      assert.equal(nonce1, '0', "nonce should be 0")

      //testrpc has a gas limit of 4.7 million, so this should run out of gas w/out hitting limit
      await txRelay.relayMetaTx(p.v, p.r, p.s, p.dest, p.data, {from: sender, gas: 3000000})

      let nonce2 = await txRelay.getNonce.call(user1)
      assert.equal(nonce2, '1', "though subcall used all gas, nonce should still update")
    })


    it('Should update nonce even if subcall throws', async function() {
      types = ['address']
      params = [user1]
      p = await signPayload(user1, sender, txRelay, runOutOfGas.address, 'testThrow',
                            types, params, lw, keyFromPw)

      let nonce1 = await txRelay.getNonce.call(user1)
      assert.equal(nonce1, '0', "nonce should be 0")

      //testrpc has a gas limit of 4.7 million, so this should run out of gas w/out hitting limit
      await txRelay.relayMetaTx(p.v, p.r, p.s, p.dest, p.data, {from: sender})

      let nonce2 = await txRelay.getNonce.call(user1)
      assert.equal(nonce2, '1', "though subcall threw, nonce should still update")
    })
  })
})
