# Disperse Token Privacy

Smart contract untuk mendistribusikan token dengan fitur privasi menggunakan teknik commitment dan nullifier.

## Fitur

- Distribusi token yang sulit dilacak
- Menggunakan sistem commitment dan nullifier
- Pemisahan waktu antara deposit dan withdrawal
- Batch processing untuk multiple recipients
- Gas-efficient implementation

## Teknologi

- Solidity ^0.8.0
- Hardhat
- OpenZeppelin Contracts
- Ethers.js

## Setup

1. Clone repository:

```bash
git clone https://github.com/alkindivv/Disperse-Token.git
cd Disperse-Token
```

2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` ke `.env` dan isi dengan nilai yang sesuai:

```bash
cp .env.example .env
```

4. Compile contracts:

```bash
npx hardhat compile
```

5. Run tests:

```bash
npx hardhat test
```

## Deployment

Deploy ke Sepolia testnet:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

## Penggunaan

1. Deploy contract
2. Generate commitment dan nullifier untuk setiap recipient
3. Deposit token ke contract
4. Tunggu beberapa block untuk privasi yang lebih baik
5. Withdraw token menggunakan commitment dan nullifier

## Security

- Menggunakan ReentrancyGuard untuk mencegah reentrancy attack
- Verifikasi commitment untuk mencegah double-spend
- Nullifier untuk memastikan setiap withdrawal hanya bisa dilakukan sekali

## License

MIT
