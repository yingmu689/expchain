import { ethers } from "ethers";
import solc from "solc";
import fs from "fs";
import banner from "./utils/banner.js";
import log from "./utils/logger.js";
import { readWallets } from "./utils/script.js";

const provider = new ethers.JsonRpcProvider("https://rpc1-testnet.expchain.ai");

// contract
const contractSource = `
pragma solidity ^0.8.0;

contract Token {
    string public name = "Expchain Token";
    string public symbol = "EXP";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Mint(address indexed to, uint256 value);
    event Burn(address indexed from, uint256 value);

    constructor(uint256 _initialSupply) {
        balanceOf[msg.sender] = _initialSupply;
        totalSupply = _initialSupply;
        emit Transfer(address(0), msg.sender, _initialSupply);
    }

    function transfer(address _to, uint256 _value) public returns (bool success) {
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");
        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function mint(address _to, uint256 _value) public {
        totalSupply += _value;
        balanceOf[_to] += _value;
        emit Mint(_to, _value);
    }

    function burn(uint256 _value) public {
        require(balanceOf[msg.sender] >= _value, "Insufficient balance to burn");
        balanceOf[msg.sender] -= _value;
        totalSupply -= _value;
        emit Burn(msg.sender, _value);
    }
}
`;

async function deployContract(PRIVATE_KEY) {
    try {
        log.info("Compiling and deploying the contract...");

        const input = {
            language: "Solidity",
            sources: {
                "Token.sol": { content: contractSource },
            },
            settings: {
                outputSelection: {
                    "*": {
                        "*": ["abi", "evm.bytecode.object"],
                    },
                },
            },
        };

        const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
        const contractABI = compiled.contracts["Token.sol"].Token.abi;
        const contractBytecode = compiled.contracts["Token.sol"].Token.evm.bytecode.object;

        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const factory = new ethers.ContractFactory(contractABI, contractBytecode, wallet);

        const initialSupply = ethers.parseUnits("1000", 18);
        const contract = await factory.deploy(initialSupply);

        await contract.waitForDeployment();

        const contractAddress = await contract.getAddress();
        log.info(`Contract deployed successfully at: ${contractAddress}`);
        log.info(`Block Explorer: https://blockscout-testnet.expchain.ai/address/${contractAddress}`);
        fs.writeFileSync(
            "Token.json",
            JSON.stringify({ abi: contractABI, address: contractAddress }, null, 2)
        );

        log.info("ABI and contract address saved to Token.json");
        await interactWithContract(contract, wallet);

    } catch (error) {
        log.error("Error deploying contract:", error);
    }
}

async function interactWithContract(contract, signer) {
    try {
        log.info("Interacting with the contract...");

        const contractWithSigner = contract.connect(signer);

        // Mint tokens
        const mintTx = await contractWithSigner.mint(signer.address, ethers.parseUnits("500", 18));
        await mintTx.wait();
        log.info("Minted 500 tokens to the contract owner.");

        // Create 10 random wallets
        const randomWallets = createRandomWallets(10);
        for (const randomWallet of randomWallets) {
            // Generate a random amount of tokens between 1 and 50 tokens
            const randomAmount = Math.floor(Math.random() * 50) + 1;
            const transferTx = await contractWithSigner.transfer(randomWallet.address, ethers.parseUnits(randomAmount.toString(), 18));
            await transferTx.wait();
            log.info(`Sent ${randomAmount} tokens to ${randomWallet.address}`);
        }

        // Burn tokens
        const burnTx = await contractWithSigner.burn(ethers.parseUnits("200", 18));
        await burnTx.wait();
        log.info("Burned 200 tokens from the contract owner.");

        // Check the balance
        const balance = await contractWithSigner.balanceOf(signer.address);
        log.info(`Current balance of owner: ${ethers.formatUnits(balance, 18)} EXP\n`);

    } catch (error) {
        log.error("Error interacting with the contract:", error);
    }
}


// Helper function to create random wallets
function createRandomWallets(number) {
    const wallets = [];
    for (let i = 0; i < number; i++) {
        const wallet = ethers.Wallet.createRandom();
        wallets.push(wallet);
    }
    return wallets;
}

async function deployContracts() {
    log.warn(banner);
    const wallets = readWallets();
    if (!wallets) {
        log.error("Please create new wallets first...");
        process.exit(1);
    }
    log.info(`Found ${wallets.length} existing wallets...`);

    while (true) {
        for (const wallet of wallets) {
            log.info(`=== Deploying Token Contract for wallet ${wallet.address} ===`);
            await deployContract(wallet.privateKey);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

deployContracts();
