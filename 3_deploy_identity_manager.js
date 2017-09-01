const IdentityManager = artifacts.require('./IdentityManager.sol')
const TxRelay = artifacts.require('./TxRelay')
const MetaIdentityManager = artifacts.require('./MetaIdentityManager.sol')

const USER_TIME_LOCK = 100;
const ADMIN_TIME_LOCK = 1000;
const ADMIN_RATE = 200;

module.exports = function (deployer) {
    deployer.deploy(IdentityManager, USER_TIME_LOCK, ADMIN_TIME_LOCK, ADMIN_RATE);
    deployer.deploy(TxRelay)
        .then(() => {
            return TxRelay.deployed();
        })
        .then((txRelay) => {
            return deployer.deploy(MetaIdentityManager, USER_TIME_LOCK, ADMIN_TIME_LOCK, ADMIN_RATE, txRelay.address);
        });
};
