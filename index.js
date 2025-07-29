import Web3 from "web3";
import chalk from "chalk";
import figlet from "figlet";
import inquirer from "inquirer";
import { ethers } from "ethers";
import fs from "fs";
import Table from "cli-table3";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

// Constants
const PHAROS_RPC = "https://api.zan.top/node/v1/pharos/testnet/54b49326c9f44b6e8730dc5dd4348421";
const WPHRS_CONTRACT = "0x76aaaDA469D23216bE5f7C596fA25F282Ff9b364";
const USDC_CONTRACT = "0x72df0bcd7276f2dFbAc900D1CE63c272C4BCcCED";
const USDT_CONTRACT = "0xD4071393f8716661958F766DF660033b3d35fD29";
const SWAP_ROUTER = "0x1A4DE519154Ae51200b0Ad7c90F7faC75547888a";
const POSITION_MANAGER = "0xF8a1D4FF0f9b9Af7CE58E1fc1833688F3BFd6115";
const API_BASE = "https://api.pharosnetwork.xyz";
const REF_CODE = "yoHvlg6UmrQWQTpw"; // Change to your ref code

// Global variables
let privateKeys = [];
let proxies = [];
let targetWallets = [];
let accountTokens = {};
let usedNonces = {};

// ABIs
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function deposit() payable",
  "function withdraw(uint256 wad)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

const SWAP_ROUTER_ABI = [{
  "inputs": [
    { "internalType": "uint256", "name": "deadline", "type": "uint256" },
    { "internalType": "bytes[]", "name": "data", "type": "bytes[]" }
  ],
  "name": "multicall",
  "outputs": [{ "internalType": "bytes[]", "name": "", "type": "bytes[]" }],
  "stateMutability": "payable",
  "type": "function"
}];

const POSITION_MANAGER_ABI = [{
  "inputs": [{
    "components": [
      { "internalType": "address", "name": "token0", "type": "address" },
      { "internalType": "address", "name": "token1", "type": "address" },
      { "internalType": "uint24", "name": "fee", "type": "uint24" },
      { "internalType": "int24", "name": "tickLower", "type": "int24" },
      { "internalType": "int24", "name": "tickUpper", "type": "int24" },
      { "internalType": "uint256", "name": "amount0Desired", "type": "uint256" },
      { "internalType": "uint256", "name": "amount1Desired", "type": "uint256" },
      { "internalType": "uint256", "name": "amount0Min", "type": "uint256" },
      { "internalType": "uint256", "name": "amount1Min", "type": "uint256" },
      { "internalType": "address", "name": "recipient", "type": "address" },
      { "internalType": "uint256", "name": "deadline", "type": "uint256" }
    ],
    "internalType": "struct INonfungiblePositionManager.MintParams",
    "name": "params",
    "type": "tuple"
  }],
  "name": "mint",
  "outputs": [
    { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
    { "internalType": "uint128", "name": "liquidity", "type": "uint128" },
    { "internalType": "uint256", "name": "amount0", "type": "uint256" },
    { "internalType": "uint256", "name": "amount1", "type": "uint256" }
  ],
  "stateMutability": "payable",
  "type": "function"
}];

// Display functions
function displayHeader() {
  console.clear();
  console.log(chalk.cyan(figlet.textSync("pharos OstadKachal", { horizontalLayout: "full" })));
  console.log(chalk.yellow("github: https://github.com/sinak1023"));
}

function formatNumber(num, decimals = 4) {
  return Number(num).toFixed(decimals);
}

function getShortAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "N/A";
}

function getRandomAmount(min, max) {
  return (Math.random() * (max - min) + min).toFixed(6);
}

// File operations
function loadPrivateKeys() {
  try {
    const data = fs.readFileSync("wallets.txt", "utf8");
    privateKeys = data.split("\n").map(key => {
      key = key.trim();
      if (key.startsWith("0x")) {
        key = key.slice(2);
      }
      return "0x" + key;
    }).filter(key => key.length === 66);
    
    if (privateKeys.length === 0) throw new Error("No valid private keys");
    console.log(chalk.green(`✅ Loaded ${privateKeys.length} wallets`));
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ Error loading wallets.txt: ${error.message}`));
    return false;
  }
}

function loadProxies() {
  try {
    const data = fs.readFileSync("proxy.txt", "utf8");
    proxies = data.split("\n").map(proxy => proxy.trim()).filter(proxy => proxy);
    console.log(chalk.green(`✅ Loaded ${proxies.length} proxies`));
  } catch (error) {
    console.log(chalk.yellow("⚠️ No proxy.txt found, running without proxies"));
    proxies = [];
  }
}

function loadTargetWallets() {
  try {
    const data = fs.readFileSync("wallet.txt", "utf8");
    targetWallets = data.split("\n").map(addr => addr.trim()).filter(addr => addr.match(/^0x[0-9a-fA-F]{40}$/));
    console.log(chalk.green(`✅ Loaded ${targetWallets.length} target wallets for transfers`));
  } catch (error) {
    console.log(chalk.yellow("⚠️ No wallet.txt found, transfer feature disabled"));
    targetWallets = [];
  }
}

// Proxy and Web3 management
function createProxyAgent(proxyUrl) {
  if (!proxyUrl) return null;
  
  try {
    if (proxyUrl.startsWith("socks")) {
      return new SocksProxyAgent(proxyUrl);
    } else if (proxyUrl.startsWith("http")) {
      return new HttpsProxyAgent(proxyUrl);
    }
    return null;
  } catch (error) {
    console.log(chalk.red(`❌ Invalid proxy format: ${proxyUrl}`));
    return null;
  }
}

function getWeb3Provider(proxyUrl = null) {
  const options = {
    keepAlive: true,
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  };

  if (proxyUrl) {
    const agent = createProxyAgent(proxyUrl);
    if (agent) {
      options.agent = agent;
    }
  }

  return new Web3.providers.HttpProvider(PHAROS_RPC, options);
}

function getEthersProvider(proxyUrl = null) {
  const fetchOptions = {};
  
  if (proxyUrl) {
    const agent = createProxyAgent(proxyUrl);
    if (agent) {
      fetchOptions.agent = agent;
    }
  }

  return new ethers.JsonRpcProvider(PHAROS_RPC, 688688, {
    fetchRequest: (url, options) => {
      return fetch(url, { ...options, ...fetchOptions });
    }
  });
}

// Initialize nonces for an address
async function initializeNonce(provider, address) {
  if (!usedNonces[address]) {
    const nonce = await provider.getTransactionCount(address, "latest");
    usedNonces[address] = nonce;
  }
  return usedNonces[address];
}

// Get next nonce
function getNextNonce(address) {
  const nonce = usedNonces[address] || 0;
  usedNonces[address] = nonce + 1;
  return nonce;
}

// API functions
async function makeApiRequest(method, url, data = null, headers = {}, proxyUrl = null) {
  const defaultHeaders = {
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Origin": "https://testnet.pharosnetwork.xyz",
    "Referer": "https://testnet.pharosnetwork.xyz/",
    ...headers
  };

  const config = {
    method,
    url,
    headers: defaultHeaders,
    timeout: 10000
  };

  if (data) config.data = data;

  if (proxyUrl) {
    const agent = createProxyAgent(proxyUrl);
    if (agent) {
      config.httpsAgent = agent;
      config.httpAgent = agent;
    }
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.msg || error.message);
  }
}

// Authentication
async function loginAccount(privateKey, proxyUrl = null) {
  try {
    const wallet = new ethers.Wallet(privateKey);
    const timestamp = new Date().toISOString();
    const nonce = Date.now().toString();
    
    const message = `testnet.pharosnetwork.xyz wants you to sign in with your Ethereum account:\n${wallet.address}\n\nI accept the Pharos Terms of Service: testnet.pharosnetwork.xyz/privacy-policy/Pharos-PrivacyPolicy.pdf\n\nURI: https://testnet.pharosnetwork.xyz\n\nVersion: 1\n\nChain ID: 688688\n\nNonce: ${nonce}\n\nIssued At: ${timestamp}`;
    
    const signature = await wallet.signMessage(message);
    
    const loginData = {
      address: wallet.address,
      signature: signature,
      wallet: "OKX Wallet",
      nonce: nonce,
      chain_id: "688688",
      timestamp: timestamp,
      domain: "testnet.pharosnetwork.xyz",
      invite_code: REF_CODE
    };
    
    const response = await makeApiRequest("post", `${API_BASE}/user/login`, loginData, {}, proxyUrl);
    
    if (response.code === 0) {
      accountTokens[wallet.address] = response.data.jwt;
      return true;
    }
    return false;
  } catch (error) {
    console.log(chalk.red(`❌ Login failed: ${error.message}`));
    return false;
  }
}

// Get balances
async function getBalances(address, proxyUrl = null) {
  try {
    const web3 = new Web3(getWeb3Provider(proxyUrl));
    
    const [phrsBalance, wphrsBalance, usdcBalance, usdtBalance] = await Promise.all([
      web3.eth.getBalance(address),
      new web3.eth.Contract(ERC20_ABI, WPHRS_CONTRACT).methods.balanceOf(address).call(),
      new web3.eth.Contract(ERC20_ABI, USDC_CONTRACT).methods.balanceOf(address).call(),
      new web3.eth.Contract(ERC20_ABI, USDT_CONTRACT).methods.balanceOf(address).call()
    ]);
    
    return {
      PHRS: formatNumber(web3.utils.fromWei(phrsBalance, 'ether')),
      WPHRS: formatNumber(web3.utils.fromWei(wphrsBalance, 'ether')),
      USDC: formatNumber(Number(usdcBalance) / 1e6),
      USDT: formatNumber(Number(usdtBalance) / 1e6)
    };
  } catch (error) {
    console.log(chalk.red(`❌ Error getting balances: ${error.message}`));
    return { PHRS: "0", WPHRS: "0", USDC: "0", USDT: "0" };
  }
}

// Daily sign-in
async function performDailySignIn() {
  console.log(chalk.cyan("\n🔄 Starting Daily Sign-In...\n"));
  
  // Process accounts concurrently
  const tasks = privateKeys.map(async (privateKey, i) => {
    const proxyUrl = proxies[i % proxies.length] || null;
    const wallet = new ethers.Wallet(privateKey);
    
    console.log(chalk.blue(`\n📍 Account ${i + 1}: ${getShortAddress(wallet.address)}`));
    
    if (!accountTokens[wallet.address]) {
      const loginSuccess = await loginAccount(privateKey, proxyUrl);
      if (!loginSuccess) {
        console.log(chalk.red("❌ Login failed, skipping..."));
        return;
      }
    }
    
    try {
      const response = await makeApiRequest(
        "post",
        `${API_BASE}/sign/in`,
        { address: wallet.address },
        { "Authorization": `Bearer ${accountTokens[wallet.address]}` },
        proxyUrl
      );
      
      if (response.code === 0) {
        console.log(chalk.green("✅ Daily sign-in successful"));
      } else {
        console.log(chalk.yellow(`⚠️ ${response.msg || "Already signed in today"}`));
      }
    } catch (error) {
      console.log(chalk.red(`❌ Sign-in error: ${error.message}`));
    }
  });
  
  await Promise.all(tasks);
  console.log(chalk.green("\n✅ Daily Sign-In completed!\n"));
}

// Claim faucet
async function claimFaucet() {
  console.log(chalk.cyan("\n🔄 Starting Faucet Claims...\n"));
  
  const tasks = privateKeys.map(async (privateKey, i) => {
    const proxyUrl = proxies[i % proxies.length] || null;
    const wallet = new ethers.Wallet(privateKey);
    
    console.log(chalk.blue(`\n📍 Account ${i + 1}: ${getShortAddress(wallet.address)}`));
    
    if (!accountTokens[wallet.address]) {
      const loginSuccess = await loginAccount(privateKey, proxyUrl);
      if (!loginSuccess) {
        console.log(chalk.red("❌ Login failed, skipping..."));
        return;
      }
    }
    
    try {
      const statusResponse = await makeApiRequest(
        "get",
        `${API_BASE}/faucet/status?address=${wallet.address}`,
        null,
        { "Authorization": `Bearer ${accountTokens[wallet.address]}` },
        proxyUrl
      );
      
      if (statusResponse.code === 0 && statusResponse.data.is_able_to_faucet) {
        const claimResponse = await makeApiRequest(
          "post",
          `${API_BASE}/faucet/daily`,
          { address: wallet.address },
          { "Authorization": `Bearer ${accountTokens[wallet.address]}` },
          proxyUrl
        );
        
        if (claimResponse.code === 0) {
          console.log(chalk.green("✅ Faucet claimed successfully"));
        } else {
          console.log(chalk.red(`❌ ${claimResponse.msg}`));
        }
      } else {
        console.log(chalk.yellow("⚠️ Already claimed today"));
      }
    } catch (error) {
      console.log(chalk.red(`❌ Faucet error: ${error.message}`));
    }
  });
  
  await Promise.all(tasks);
  console.log(chalk.green("\n✅ Faucet Claims completed!\n"));
}

// Transfer PHRS
async function performTransfers() {
  if (targetWallets.length === 0) {
    console.log(chalk.yellow("\n⚠️ No target wallets loaded for transfers\n"));
    return;
  }
  
  console.log(chalk.cyan("\n🔄 Starting Transfers...\n"));
  
  const { transferCount, transferAmount } = await inquirer.prompt([
    {
      type: "number",
      name: "transferCount",
      message: "Number of transfers per account:",
      default: 5,
      validate: (value) => value > 0 ? true : "Please enter a valid number"
    },
    {
      type: "input",
      name: "transferAmount",
      message: "Amount to transfer (PHRS):",
      default: "0.001",
      validate: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0 ? true : "Please enter a valid amount";
      },
      filter: (value) => parseFloat(value)
    }
  ]);
  
  const tasks = privateKeys.map(async (privateKey, i) => {
    const proxyUrl = proxies[i % proxies.length] || null;
    const provider = getEthersProvider(proxyUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(chalk.blue(`\n📍 Account ${i + 1}: ${getShortAddress(wallet.address)}`));
    
    await initializeNonce(provider, wallet.address);
    
    for (let j = 0; j < transferCount; j++) {
      try {
        const toAddress = targetWallets[Math.floor(Math.random() * targetWallets.length)];
        const nonce = getNextNonce(wallet.address);
        const feeData = await provider.getFeeData();
        
        const tx = await wallet.sendTransaction({
          to: toAddress,
          value: ethers.parseEther(transferAmount.toString()),
          gasLimit: 21000,
          maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits("1", "gwei"),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits("0.5", "gwei"),
          nonce
        });
        
        console.log(chalk.green(`✅ Transfer ${j + 1}: ${transferAmount} PHRS to ${getShortAddress(toAddress)}`));
        console.log(chalk.gray(`   Hash: ${tx.hash}`));
        
        await tx.wait();
      } catch (error) {
        console.log(chalk.red(`❌ Transfer ${j + 1} failed: ${error.message}`));
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  });
  
  await Promise.all(tasks);
  console.log(chalk.green("\n✅ Transfers completed!\n"));
}

// Wrap/Unwrap PHRS
async function performWrapUnwrap(isWrap = true) {
  console.log(chalk.cyan(`\n🔄 Starting ${isWrap ? "Wrap" : "Unwrap"} operations...\n`));
  
  const { count, minAmount, maxAmount } = await inquirer.prompt([
    {
      type: "number",
      name: "count",
      message: `Number of ${isWrap ? "wrap" : "unwrap"} operations per account:`,
      default: 3,
      validate: (value) => value > 0 ? true : "Please enter a valid number"
    },
    {
      type: "input",
      name: "minAmount",
      message: `Minimum amount to ${isWrap ? "wrap" : "unwrap"}:`,
      default: "0.0001",
      validate: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0 ? true : "Please enter a valid amount";
      },
      filter: (value) => parseFloat(value)
    },
    {
      type: "input",
      name: "maxAmount",
      message: `Maximum amount to ${isWrap ? "wrap" : "unwrap"}:`,
      default: "0.001",
      validate: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0 ? true : "Please enter a valid amount";
      },
      filter: (value) => parseFloat(value)
    }
  ]);
  
  const tasks = privateKeys.map(async (privateKey, i) => {
    const proxyUrl = proxies[i % proxies.length] || null;
    const provider = getEthersProvider(proxyUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(chalk.blue(`\n📍 Account ${i + 1}: ${getShortAddress(wallet.address)}`));
    
    await initializeNonce(provider, wallet.address);
    
    for (let j = 0; j < count; j++) {
      try {
        const amount = getRandomAmount(minAmount, maxAmount);
        const wphrsContract = new ethers.Contract(WPHRS_CONTRACT, ERC20_ABI, wallet);
        const nonce = getNextNonce(wallet.address);
        const feeData = await provider.getFeeData();
        
        if (isWrap) {
          const balance = await provider.getBalance(wallet.address);
          const needed = ethers.parseEther(amount) + ethers.parseEther("0.001");
          if (balance < needed) {
            console.log(chalk.yellow(`⚠️ Insufficient PHRS balance for wrap ${j + 1}`));
            continue;
          }
        } else {
          const balance = await wphrsContract.balanceOf(wallet.address);
          if (balance < ethers.parseEther(amount)) {
            console.log(chalk.yellow(`⚠️ Insufficient WPHRS balance for unwrap ${j + 1}`));
            continue;
          }
        }
        
        let tx;
        if (isWrap) {
          tx = await wphrsContract.deposit({
            value: ethers.parseEther(amount),
            gasLimit: 100000,
            maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits("1", "gwei"),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits("0.5", "gwei"),
            nonce
          });
          console.log(chalk.green(`✅ Wrap ${j + 1}: ${amount} PHRS to WPHRS`));
        } else {
          tx = await wphrsContract.withdraw(ethers.parseEther(amount), {
            gasLimit: 100000,
            maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits("1", "gwei"),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits("0.5", "gwei"),
            nonce
          });
          console.log(chalk.green(`✅ Unwrap ${j + 1}: ${amount} WPHRS to PHRS`));
        }
        
        console.log(chalk.gray(`   Hash: ${tx.hash}`));
        await tx.wait();
        
      } catch (error) {
        console.log(chalk.red(`❌ ${isWrap ? "Wrap" : "Unwrap"} ${j + 1} failed: ${error.message}`));
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  });
  
  await Promise.all(tasks);
  console.log(chalk.green(`\n✅ ${isWrap ? "Wrap" : "Unwrap"} operations completed!\n`));
}

// Fixed Swap function - exactly like Python version
async function performSwaps() {
  console.log(chalk.cyan("\n🔄 Starting Swaps...\n"));
  
  const swapOptions = [
    { from: WPHRS_CONTRACT, to: USDC_CONTRACT, fromName: "WPHRS", toName: "USDC" },
    { from: WPHRS_CONTRACT, to: USDT_CONTRACT, fromName: "WPHRS", toName: "USDT" },
    { from: USDC_CONTRACT, to: WPHRS_CONTRACT, fromName: "USDC", toName: "WPHRS" },
    { from: USDT_CONTRACT, to: WPHRS_CONTRACT, fromName: "USDT", toName: "WPHRS" },
    { from: USDC_CONTRACT, to: USDT_CONTRACT, fromName: "USDC", toName: "USDT" },
    { from: USDT_CONTRACT, to: USDC_CONTRACT, fromName: "USDT", toName: "USDC" }
  ];
  
  const { swapCount, minAmount, maxAmount } = await inquirer.prompt([
    {
      type: "number",
      name: "swapCount",
      message: "Number of swaps per account:",
      default: 5,
      validate: (value) => value > 0 ? true : "Please enter a valid number"
    },
    {
      type: "input",
      name: "minAmount",
      message: "Minimum amount to swap:",
      default: "0.0001",
      validate: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0 ? true : "Please enter a valid amount";
      },
      filter: (value) => parseFloat(value)
    },
    {
      type: "input",
      name: "maxAmount",
      message: "Maximum amount to swap:",
      default: "0.001",
      validate: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0 ? true : "Please enter a valid amount";
      },
      filter: (value) => parseFloat(value)
    }
  ]);
  
  const tasks = privateKeys.map(async (privateKey, i) => {
    const proxyUrl = proxies[i % proxies.length] || null;
    const provider = getEthersProvider(proxyUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(chalk.blue(`\n📍 Account ${i + 1}: ${getShortAddress(wallet.address)}`));
    
    await initializeNonce(provider, wallet.address);
    
    for (let j = 0; j < swapCount; j++) {
      const swap = swapOptions[Math.floor(Math.random() * swapOptions.length)];
      const swapAmount = getRandomAmount(minAmount, maxAmount);
      
      try {
        // Get decimals for from token
        const tokenContract = new ethers.Contract(swap.from, ERC20_ABI, wallet);
        const decimals = await tokenContract.decimals();
        const amount = ethers.parseUnits(swapAmount, decimals);
        
        // Check balance
        const balance = await tokenContract.balanceOf(wallet.address);
        if (balance < amount) {
          console.log(chalk.yellow(`⚠️ Insufficient ${swap.fromName} balance for swap ${j + 1}`));
          continue;
        }
        
        // Approve token
        const allowance = await tokenContract.allowance(wallet.address, SWAP_ROUTER);
        if (allowance < amount) {
          console.log(chalk.yellow(`   Approving ${swap.fromName}...`));
          const nonce = getNextNonce(wallet.address);
          const feeData = await provider.getFeeData();
          
          const approveTx = await tokenContract.approve(SWAP_ROUTER, ethers.MaxUint256, {
            gasLimit: 100000,
            maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits("1", "gwei"),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits("0.5", "gwei"),
            nonce
          });
          console.log(chalk.gray(`   Approve tx: ${approveTx.hash}`));
          await approveTx.wait();
          console.log(chalk.green(`   ✅ Approved`));
          
          // Wait after approval
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
        // Perform swap using exact Python method structure
        const routerContract = new ethers.Contract(SWAP_ROUTER, SWAP_ROUTER_ABI, wallet);
        const deadline = Math.floor(Date.now() / 1000) + 300;
        
        // Encode swap data exactly like Python
        const abiCoder = new ethers.AbiCoder();
        const encodedData = abiCoder.encode(
          ["address", "address", "uint256", "address", "uint256", "uint256", "uint256"],
          [
            swap.from,
            swap.to,
            500,
            wallet.address,
            amount,
            0,
            0
          ]
        );
        // Create multicall data
        const multicallData = ["0x04e45aaf" + encodedData.slice(2)];
        
        const swapNonce = getNextNonce(wallet.address);
        const swapFeeData = await provider.getFeeData();
        
        const tx = await routerContract.multicall(deadline, multicallData, {
          gasLimit: 300000,
          maxFeePerGas: swapFeeData.maxFeePerGas || ethers.parseUnits("2", "gwei"),
          maxPriorityFeePerGas: swapFeeData.maxPriorityFeePerGas || ethers.parseUnits("1", "gwei"),
          nonce: swapNonce
        });
        
        console.log(chalk.green(`✅ Swap ${j + 1}: ${swapAmount} ${swap.fromName} → ${swap.toName}`));
        console.log(chalk.gray(`   Hash: ${tx.hash}`));
        
        const receipt = await tx.wait();
        console.log(chalk.green(`   ✅ Confirmed in block ${receipt.blockNumber}`));
        
      } catch (error) {
        console.log(chalk.red(`❌ Swap ${j + 1} failed: ${error.message}`));
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  });
  
  await Promise.all(tasks);
  console.log(chalk.green("\n✅ Swaps completed!\n"));
}

// Fixed Add Liquidity function - exactly like Python version
async function addLiquidity() {
  console.log(chalk.cyan("\n🔄 Starting Add Liquidity...\n"));
  
  const lpOptions = [
    { token0: USDC_CONTRACT, token1: WPHRS_CONTRACT, amount0: "0.45", amount1: "0.001", name: "USDC/WPHRS" },
    { token0: USDC_CONTRACT, token1: USDT_CONTRACT, amount0: "1", amount1: "1", name: "USDC/USDT" },
    { token0: USDT_CONTRACT, token1: WPHRS_CONTRACT, amount0: "0.45", amount1: "0.001", name: "USDT/WPHRS" }
  ];
  
  const { lpCount } = await inquirer.prompt([{
    type: "number",
    name: "lpCount",
    message: "Number of liquidity additions per account:",
    default: 3,
    validate: (value) => value > 0 ? true : "Please enter a valid number"
  }]);
  
  const tasks = privateKeys.map(async (privateKey, i) => {
    const proxyUrl = proxies[i % proxies.length] || null;
    const provider = getEthersProvider(proxyUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(chalk.blue(`\n📍 Account ${i + 1}: ${getShortAddress(wallet.address)}`));
    
    await initializeNonce(provider, wallet.address);
    
    for (let j = 0; j < lpCount; j++) {
      const lp = lpOptions[Math.floor(Math.random() * lpOptions.length)];
      
      try {
        // Sort tokens (token0 must be < token1) like Python
        let token0 = lp.token0;
        let token1 = lp.token1;
        let amount0 = lp.amount0;
        let amount1 = lp.amount1;
        
        if (token0.toLowerCase() > token1.toLowerCase()) {
          [token0, token1] = [token1, token0];
          [amount0, amount1] = [amount1, amount0];
        }
        
        // Get decimals for each token individually
        const token0Contract = new ethers.Contract(token0, ERC20_ABI, wallet);
        const token1Contract = new ethers.Contract(token1, ERC20_ABI, wallet);
        
        const decimals0 = await token0Contract.decimals();
        const decimals1 = await token1Contract.decimals();
        
        const amount0Wei = ethers.parseUnits(amount0, decimals0);
        const amount1Wei = ethers.parseUnits(amount1, decimals1);
        
        // Approve both tokens with delay
        for (const [contract, amountWei, tokenName] of [[token0Contract, amount0Wei, "Token0"], [token1Contract, amount1Wei, "Token1"]]) {
          const allowance = await contract.allowance(wallet.address, POSITION_MANAGER);
          if (allowance < amountWei) {
            console.log(chalk.yellow(`   Approving ${tokenName}...`));
            const nonce = getNextNonce(wallet.address);
            const feeData = await provider.getFeeData();
            
            const approveTx = await contract.approve(POSITION_MANAGER, ethers.MaxUint256, {
              gasLimit: 100000,
              maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits("1", "gwei"),
              maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits("0.5", "gwei"),
              nonce
            });
            await approveTx.wait();
            console.log(chalk.green(`   ✅ Approved`));
            
            // Wait 10 seconds after each approval like Python
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }
        
        // Add liquidity
        const lpContract = new ethers.Contract(POSITION_MANAGER, POSITION_MANAGER_ABI, wallet);
        const nonce = getNextNonce(wallet.address);
        const feeData = await provider.getFeeData();
        
        const mintParams = {
          token0: token0,
          token1: token1,
          fee: 500,
          tickLower: -887270,
          tickUpper: 887270,
          amount0Desired: amount0Wei,
          amount1Desired: amount1Wei,
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallet.address,
          deadline: Math.floor(Date.now() / 1000) + 600
        };
        
        const tx = await lpContract.mint(mintParams, {
          gasLimit: 600000,
          maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits("5", "gwei"),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits("1", "gwei"),
          nonce
        });
        
        console.log(chalk.green(`✅ LP ${j + 1}: Added liquidity to ${lp.name}`));
        console.log(chalk.gray(`   Hash: ${tx.hash}`));
        
        const receipt = await tx.wait();
        console.log(chalk.green(`   ✅ Confirmed in block ${receipt.blockNumber}`));
        
      } catch (error) {
        console.log(chalk.red(`❌ LP ${j + 1} failed: ${error.message}`));
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  });
  
  await Promise.all(tasks);
  console.log(chalk.green("\n✅ Add Liquidity completed!\n"));
}

// Display all accounts
async function displayAccounts() {
  console.log(chalk.cyan("\n📊 Account Balances\n"));
  
  const table = new Table({
    head: ["#", "Address", "PHRS", "WPHRS", "USDC", "USDT"],
    colWidths: [5, 20, 12, 12, 12, 12],
    style: { head: ["cyan"] }
  });
  
  for (let i = 0; i < privateKeys.length; i++) {
    const wallet = new ethers.Wallet(privateKeys[i]);
    const proxyUrl = proxies[i % proxies.length] || null;
    const balances = await getBalances(wallet.address, proxyUrl);
    
    table.push([
      i + 1,
      getShortAddress(wallet.address),
      balances.PHRS,
      balances.WPHRS,
      balances.USDC,
      balances.USDT
    ]);
  }
  
  console.log(table.toString());
}

// Main menu
async function mainMenu() {
  displayHeader();
  
  const choices = [
    "1. Daily Sign-In",
    "2. Claim Faucet",
    "3. Send PHRS to Friends",
    "4. Wrap PHRS to WPHRS",
    "5. Unwrap WPHRS to PHRS",
    "6. Swap Tokens",
    "7. Add Liquidity",
    "8. Display All Accounts",
    "9. Run All Activities",
    "0. Exit"
  ];
  
  const { choice } = await inquirer.prompt([{
    type: "list",
    name: "choice",
    message: "Select an option:",
    choices
  }]);
  
  const option = parseInt(choice.split(".")[0]);
  
  switch (option) {
    case 1:
      await performDailySignIn();
      break;
    case 2:
      await claimFaucet();
      break;
    case 3:
      await performTransfers();
      break;
    case 4:
      await performWrapUnwrap(true);
      break;
    case 5:
      await performWrapUnwrap(false);
      break;
    case 6:
      await performSwaps();
      break;
    case 7:
      await addLiquidity();
      break;
    case 8:
      await displayAccounts();
      break;
    case 9:
      await runAllActivities();
      break;
    case 0:
      console.log(chalk.yellow("\n👋 Goodbye!\n"));
      process.exit(0);
  }
  
  await inquirer.prompt([{
    type: "input",
    name: "continue",
    message: "Press Enter to continue..."
  }]);
  
  await mainMenu();
}

// Run all activities
async function runAllActivities() {
  console.log(chalk.cyan("\n🚀 Running all activities...\n"));
  
  await performDailySignIn();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await claimFaucet();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (targetWallets.length > 0) {
    console.log(chalk.cyan("\n📤 Auto Transfer (5 txs, 0.001 PHRS each)"));
    const tasks = privateKeys.map(async (privateKey, i) => {
      const proxyUrl = proxies[i % proxies.length] || null;
      const provider = getEthersProvider(proxyUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      
      console.log(chalk.blue(`\n📍 Account ${i + 1}: ${getShortAddress(wallet.address)}`));
      
      await initializeNonce(provider, wallet.address);
      
      for (let j = 0; j < 5; j++) {
        try {
          const toAddress = targetWallets[Math.floor(Math.random() * targetWallets.length)];
          const nonce = getNextNonce(wallet.address);
          const feeData = await provider.getFeeData();
          
          const tx = await wallet.sendTransaction({
            to: toAddress,
            value: ethers.parseEther("0.001"),
            gasLimit: 21000,
            maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits("1", "gwei"),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits("0.5", "gwei"),
            nonce
          });
          
          console.log(chalk.green(`✅ Transfer ${j + 1}: 0.001 PHRS to ${getShortAddress(toAddress)}`));
          await tx.wait();
        } catch (error) {
          console.log(chalk.red(`❌ Transfer ${j + 1} failed: ${error.message}`));
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    });
    
    await Promise.all(tasks);
  }
  
  console.log(chalk.green("\n✅ All activities completed!\n"));
}

// Main function
async function main() {
  displayHeader();
  
  // Load necessary files
  if (!loadPrivateKeys()) {
    console.log(chalk.red("\n❌ Please create wallets.txt with private keys\n"));
    process.exit(1);
  }
  
  loadProxies();
  loadTargetWallets();
  
  console.log(chalk.green(`\n✅ Bot initialized successfully!\n`));
  
  await mainMenu();
}

// Start the bot
main().catch(error => {
  console.error(chalk.red("\n❌ Fatal error:"), error);
  process.exit(1);
});
