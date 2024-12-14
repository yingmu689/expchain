import { solveAntiCaptcha, solve2Captcha } from "./utils/solver.js";
import { readWallets } from "./utils/script.js";
import banner from "./utils/banner.js";
import log from "./utils/logger.js";
import readline from "readline";

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

async function getFaucet(payload) {
    const url = "https://faucetv2-api.expchain.ai/api/faucet";
    try {
        log.info("Getting Faucet...");
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
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

    while (true) {
        for (const wallet of wallets) {
            log.info(`=== Starting Getting Faucet for wallet ${wallet.address} ===`);
            const payloadFaucet = {
                chain_id: 18880,
                to: wallet.address,
                cf_turnstile_response: await solveCaptcha(apiKey),
            };
            const faucet = await getFaucet(payloadFaucet);

            if (faucet.message === 'Success') {
                log.info(`Faucet Success https://blockscout-testnet.expchain.ai/address/${wallet.address}`)
            } else {
                log.error(`${faucet.data} Claim Faucet Failed...`)
            }
            log.info(`== Santuy, Cooldown 10 minutes before claim again ==`);
            log.info(`== Ctrl + C to exit or run this on screen to get faucet every 10 minutes ==`);
            await new Promise((resolve) => setTimeout(resolve, 10 * 60 * 1000));
        }
    }
}

getFaucetAll();
