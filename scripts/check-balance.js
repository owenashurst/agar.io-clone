require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
  // Get address from command line arg, or default to env wallet
  const addressArg = process.argv[2];
  
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'https://sepolia.base.org');
  let targetAddress;

  if (addressArg) {
    if (!ethers.utils.isAddress(addressArg)) {
      console.error('Error: Invalid address format');
      process.exit(1);
    }
    targetAddress = addressArg;
  } else {
    // If no address provided, use the wallet from .env
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY;
    if (!privateKey) {
      console.error('Error: No address provided and no private key found in .env');
      console.log('Usage: node scripts/check-balance.js [address]');
      process.exit(1);
    }
    const wallet = new ethers.Wallet(privateKey, provider);
    targetAddress = wallet.address;
  }

  const usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) {
    console.error('Error: USDC_ADDRESS not set in .env');
    process.exit(1);
  }

  console.log('\nChecking balance for:', targetAddress);
  console.log('---------------------------------------------------');

  // 1. Check ETH Balance (Native Token)
  try {
    const ethBalance = await provider.getBalance(targetAddress);
    console.log('ETH Balance: ', ethers.utils.formatEther(ethBalance), 'ETH');
  } catch (error) {
    console.error('Error fetching ETH balance:', error.message);
  }

  // 2. Check USDC Balance
  try {
    const usdcABI = [
      'function balanceOf(address account) external view returns (uint256)',
      'function decimals() external view returns (uint8)',
      'function symbol() external view returns (string)'
    ];
    
    const usdcContract = new ethers.Contract(usdcAddress, usdcABI, provider);
    const balance = await usdcContract.balanceOf(targetAddress);
    const decimals = await usdcContract.decimals();
    const symbol = await usdcContract.symbol();
    
    console.log(`${symbol} Balance:`, ethers.utils.formatUnits(balance, decimals), symbol);
  } catch (error) {
    console.error('Error fetching USDC balance:', error.message);
  }
  console.log('---------------------------------------------------\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

