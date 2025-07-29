# Pharos Network Testnet Bot

A comprehensive automation bot for interacting with the Pharos Network testnet, built with Node.js and Web3.js. This bot provides various features including daily sign-ins, faucet claims, token swaps, liquidity provision, and more.

## 🚀 Features

- **Daily Sign-In**: Automatically sign in to collect daily rewards
- **Faucet Claims**: Claim testnet tokens from the faucet
- **Token Transfers**: Send PHRS tokens to multiple addresses
- **Token Wrapping**: Convert between PHRS and WPHRS (Wrapped PHRS)
- **Token Swaps**: Execute swaps between WPHRS, USDC, and USDT
- **Liquidity Provision**: Add liquidity to various token pairs
- **Multi-Account Support**: Manage multiple wallets simultaneously
- **Proxy Support**: Optional HTTP/SOCKS proxy configuration
- **Balance Display**: View all account balances in a formatted table

## 📋 Prerequisites

- Node.js v16.0.0 or higher
- npm or yarn package manager
- Private keys for Ethereum wallets
- (Optional) Proxy servers for enhanced privacy

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/sinak1023/pharos-multi-bot.git
cd pharos-multi-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create required configuration files:

**wallets.txt** - Add your private keys (one per line):
```
0x1234567890abcdef...
0xabcdef1234567890...
```
**wallet.txt** - Add target addresses for transfers (one per line):
```
0x742d35Cc6634C0532925a3b844Bc9e7595f6745d
0x53d284357ec70cE289D6D64134DfAc8E51c87854
```
**proxy.txt** (Optional) - Add proxy URLs (one per line):
```
http://username:password@proxy1.com:8080
socks5://username:password@proxy2.com:1080
```
## 🎯 Usage

Run the bot:
```bash
node index.js
```
### Main Menu Options

1. **Daily Sign-In**: Claims daily rewards for all accounts
2. **Claim Faucet**: Requests testnet tokens from the faucet
3. **Send PHRS to Friends**: Transfer PHRS tokens to addresses in wallet.txt
4. **Wrap PHRS to WPHRS**: Convert native PHRS to wrapped version
5. **Unwrap WPHRS to PHRS**: Convert wrapped PHRS back to native
6. **Swap Tokens**: Execute token swaps between supported pairs
7. **Add Liquidity**: Provide liquidity to trading pairs
8. **Display All Accounts**: Show balance overview for all wallets
9. **Run All Activities**: Execute all activities automatically
0. **Exit**: Close the application

## 🔧 Configuration

### Network Details
- **Network**: Pharos Testnet
- **Chain ID**: 688688
- **RPC URL**: https://api.zan.top/node/v1/pharos/testnet/5d493fbfc2a24cc9864430ca10fea19a

### Supported Tokens
- **PHRS**: Native token
- **WPHRS**: 0x76aaaDA469D23216bE5f7C596fA25F282Ff9b364
- **USDC**: 0x72df0bcd7276f2dFbAc900D1CE63c272C4BCcCED
- **USDT**: 0xD4071393f8716661958F766DF660033b3d35fD29

### Contract Addresses
- **Swap Router**: 0x1A4DE519154Ae51200b0Ad7c90F7faC75547888a
- **Position Manager**: 0xF8a1D4FF0f9b9Af7CE58E1fc1833688F3BFd6115

## 📝 File Structure


pharos-testnet-bot/

├── index.js           # Main bot script
├── wallets.txt        # Private keys (create this)
├── wallet.txt         # Target addresses (create this)
├── proxy.txt          # Proxy list (optional)
├── package.json       # Node.js dependencies
├── README.md          # This file
└── LICENSE           # MIT License

## ⚙️ Advanced Configuration

### Referral Code
The bot includes a referral code system. To change the referral code, modify the `REF_CODE` constant in index.js:
javascript
const REF_CODE = `yoHvlg6UmrQWQTpw`

### Custom RPC
To use a different RPC endpoint, modify the `PHAROS_RPC` constant:
javascript
const PHAROS_RPC = "your-custom-rpc-url";

## 🔒 Security Considerations

1. **Private Key Security**: 
   - Never share your private keys
   - Keep wallets.txt secure and add it to .gitignore
   - Use testnet keys only

2. **Proxy Usage**:
   - Verify proxy reliability before use
   - Use authenticated proxies when possible
   - Monitor proxy performance

3. **Transaction Safety**:
   - The bot includes nonce management to prevent conflicts
   - Gas prices are dynamically fetched
   - Failed transactions are logged but don't stop execution

## 🐛 Troubleshooting

### Common Issues

1. **"No valid private keys"**
   - Ensure wallets.txt exists and contains valid private keys
   - Keys should be 64 characters (without 0x prefix)

2. **"Insufficient balance" errors**
   - Check account balances using option 8
   - Claim faucet tokens if needed

3. **Transaction failures**
   - Verify network connectivity
   - Check if proxy is working (if used)
   - Ensure sufficient gas balance

4. **API errors**
   - Check if the Pharos testnet is operational
   - Verify API endpoints are accessible
   - Try without proxy if issues persist

## 📊 Performance Tips

1. **Batch Operations**: The bot processes accounts concurrently for efficiency
2. **Rate Limiting**: Built-in delays prevent API throttling
3. **Nonce Management**: Automatic nonce tracking prevents transaction conflicts
4. **Gas Optimization**: Dynamic gas pricing ensures cost-effective transactions

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## ⚠️ Disclaimer

This bot is for educational and testing purposes only.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Pharos Network team for the testnet
- Web3.js and Ethers.js communities
- Contributors and testers

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section
or you can send me a dm on telegram : https://t.me/sinox0101
---

**Note**: This is testnet software. Do not use with mainnet keys or real funds.
