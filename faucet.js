import { solveAntiCaptcha, solve2Captcha } from "./utils/solver.js";
import { readWallets, readProxies } from "./utils/script.js";
import banner from "./utils/banner.js";
import log from "./utils/logger.js";
import readline from "readline";
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import chalk from 'chalk';

function askUserOption() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question(
            "Choose Captcha Solver:\n1. Anti-Captcha\n2. 2Captcha\nEnter your choice (1/2): ",
            (answer) => {
                rl.close();
                resolve(answer);
            }
        );
    });
}

function askApiKey(solverName) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question(`Enter your API key for ${solverName}: `, (apiKey) => {
            rl.close();
            resolve(apiKey);
        });
    });
}

async function getFaucet(payload, proxy) {
    const url = "https://faucetv2-api.expchain.ai/api/faucet";

    try {
        const agent = new HttpsProxyAgent(proxy);

        log.info("Getting Faucet...");


        const response = await axios.post(url, payload, {
            headers: {
                "Content-Type": "application/json",
            },
            httpsAgent: agent,
        });

        const data = response.data;
        return data;
    } catch (error) {
        log.error("Error Getting Faucet:", error);
    }
}

async function getFaucetAll() {
    log.warn(banner);

    const wallets = readWallets();
    if (!wallets) {
        log.error("Please Create new wallets first...");
        process.exit(1);
    }
    log.info(`Found ${wallets.length} existing wallets...`);

    const userChoice = await askUserOption();
    let solveCaptcha;
    let apiKey;

    if (userChoice === "1") {
        log.info("Using Anti-Captcha Solver...");
        solveCaptcha = solveAntiCaptcha;
        apiKey = await askApiKey("Anti-Captcha");
    } else if (userChoice === "2") {
        log.info("Using 2Captcha Solver...");
        solveCaptcha = solve2Captcha;
        apiKey = await askApiKey("2Captcha");
    } else {
        log.error("Invalid choice! Exiting...");
        process.exit(1);
    }

    const proxies = readProxies();
    if (proxies.length === 0) {
        log.error("No proxies found! Exiting...");
        process.exit(1);
    }

    let proxyIndex = 0;

    while (true) {
        for (const wallet of wallets) {
            log.info(`=== Starting Getting Faucet for wallet ${wallet.address} ===`);

            const proxy = 'http://' + proxies[proxyIndex];
            log.info(chalk.cyan(`Using proxy: ${proxy}`));

            const payloadFaucet = {
                chain_id: 18880,
                to: wallet.address,
                cf_turnstile_response: await solveCaptcha(apiKey),
            };


            const faucet = await getFaucet(payloadFaucet, proxy);

            if (faucet && faucet.message === 'Success') {
                log.info(chalk.green(`Faucet Success https://blockscout-testnet.expchain.ai/address/${wallet.address}`));
            } else {
                log.error(chalk.red(`${faucet?.data || 'Unknown error'} Claim Faucet Failed...`));
            }

            proxyIndex = (proxyIndex + 1) % proxies.length;

            log.info(`== Moving to next wallet with next proxy ==`);
        }
    }
}

getFaucetAll();
