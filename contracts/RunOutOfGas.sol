pragma solidity ^0.4.11;

contract RunOutOfGas{
  function testOOG(address forMTX) {
    uint i = 0;
    while(true) {
      i++;
    }
  }

  function testThrow(address forMTX) {
    throw;
  }
}
