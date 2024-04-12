import { viem } from "hardhat";
import { parseEther, formatEther, Address } from "viem";
import * as readline from "readline";

const MAXUINT256 =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n;

let contractAddress: Address;
let tokenAddress: Address;

const BET_PRICE = "1";
const BET_FEE = "0.2";
const TOKEN_RATIO = 1n;

async function main() {
  await initContracts();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  mainMenu(rl);
}

async function initAccounts() {
  // TODO >> not necessary
}

async function initContracts() {
  const contract = await viem.deployContract("Lottery", [
    "Lottery",
    "LTR",
    TOKEN_RATIO,
    parseEther(BET_PRICE),
    parseEther(BET_FEE),
  ]);
  contractAddress = contract.address;
  tokenAddress = await contract.read.paymentToken();
}

async function getAccounts() {
  return await viem.getWalletClients();
}

async function getClient() {
  return await viem.getPublicClient();
}

async function mainMenu(rl: readline.Interface) {
  menuOptions(rl);
}

function menuOptions(rl: readline.Interface) {
  rl.question(
    "Select operation: \n Options: \n [0]: Exit \n [1]: Check state \n [2]: Open bets \n [3]: Top up account tokens \n [4]: Bet with account \n [5]: Close bets \n [6]: Check player prize \n [7]: Withdraw \n [8]: Burn tokens \n",
    async (answer: string) => {
      console.log(`Selected: ${answer}\n`);
      const option = Number(answer);
      switch (option) {
        case 0:
          rl.close();
          return;
        case 1:
          await checkState();
          mainMenu(rl);
          break;
        case 2:
          rl.question("Input duration (in seconds)\n", async (duration) => {
            try {
              await openBets(duration);
            } catch (error) {
              console.log("error\n");
              console.log({ error });
            }
            mainMenu(rl);
          });
          break;
        case 3:
          rl.question("What account (index) to use?\n", async (index) => {
            await displayBalance(index);
            rl.question("Buy how many tokens?\n", async (amount) => {
              try {
                await buyTokens(index, amount);
                await displayBalance(index);
                await displayTokenBalance(index);
              } catch (error) {
                console.log("error\n");
                console.log({ error });
              }
              mainMenu(rl);
            });
          });
          break;
        case 4:
          rl.question("What account (index) to use?\n", async (index) => {
            await displayTokenBalance(index);
            rl.question("Bet how many times?\n", async (amount) => {
              try {
                await bet(index, amount);
                await displayTokenBalance(index);
              } catch (error) {
                console.log("error\n");
                console.log({ error });
              }
              mainMenu(rl);
            });
          });
          break;
        case 5:
          try {
            await closeLottery();
          } catch (error) {
            console.log("error\n");
            console.log({ error });
          }
          mainMenu(rl);
          break;
        case 6:
          rl.question("What account (index) to use?\n", async (index) => {
            const prize = await displayPrize(index);
            if (Number(prize) > 0) {
              rl.question(
                "Do you want to claim your prize? [Y/N]\n",
                async (answer) => {
                  if (answer.toLowerCase() === "y") {
                    try {
                      await claimPrize(index, prize);
                    } catch (error) {
                      console.log("error\n");
                      console.log({ error });
                    }
                  }
                  mainMenu(rl);
                }
              );
            } else {
              mainMenu(rl);
            }
          });
          break;
        case 7:
          await displayTokenBalance("0");
          await displayOwnerPool();
          rl.question("Withdraw how many tokens?\n", async (amount) => {
            try {
              await withdrawTokens(amount);
            } catch (error) {
              console.log("error\n");
              console.log({ error });
            }
            mainMenu(rl);
          });
          break;
        case 8:
          rl.question("What account (index) to use?\n", async (index) => {
            await displayTokenBalance(index);
            rl.question("Burn how many tokens?\n", async (amount) => {
              try {
                await burnTokens(index, amount);
                await displayBalance(index);
                await displayTokenBalance(index);
              } catch (error) {
                console.log("error\n");
                console.log({ error });
              }
              mainMenu(rl);
            });
          });
          break;
        default:
          throw new Error("Invalid option");
      }
    }
  );
}

async function checkState() {
  const contract = await viem.getContractAt("Lottery", contractAddress);
  const state = await contract.read.betsOpen();
  console.log(`The lottery is ${state ? "open" : "closed"}\n`);
  if (!state) return;
  const publicClient = await getClient();
  const currentBlock = await publicClient.getBlock();
  const timestamp = Number(currentBlock?.timestamp) ?? 0;
  const currentBlockDate = new Date(timestamp * 1000);
  const closingTime = await contract.read.betsClosingTime();
  const closingTimeDate = new Date(Number(closingTime) * 1000);
  console.log(
    `The last block was mined at ${currentBlockDate.toLocaleDateString()} : ${currentBlockDate.toLocaleTimeString()}\n`
  );
  console.log(
    `Lottery should close at ${closingTimeDate.toLocaleDateString()} : ${closingTimeDate.toLocaleTimeString()}\n`
  );
}

async function openBets(duration: string) {
  const contract = await viem.getContractAt("Lottery", contractAddress);
  const publicClient = await getClient();
  const currentBlock = await publicClient.getBlock();
  const timestamp = currentBlock?.timestamp ?? 0;
  const tx = await contract.write.openBets([timestamp + BigInt(duration)]);
  const receipt = await publicClient.getTransactionReceipt({ hash: tx });
  console.log(`Bets opened (${receipt?.transactionHash})`);
}

async function displayBalance(index: string) {
  const publicClient = await getClient();
  const accounts = await getAccounts();
  const balanceBN = await publicClient.getBalance({
    address: accounts[Number(index)].account.address,
  });
  const balance = formatEther(balanceBN);
  console.log(
    `The account of address ${
      accounts[Number(index)].account.address
    } has ${balance} ETH\n`
  );
}

async function buyTokens(index: string, amount: string) {
  const publicClient = await getClient();
  const accounts = await getAccounts(); // Retrieve accounts
  const signer = accounts[Number(index)].account.address; // signer is the address at index

  // Retrieve the Lottery contract instance
  const lotteryContract = await viem.getContractAt("Lottery", contractAddress);



  try {
      // Sending ETH to purchase tokens. Using the connected account based on the index.

    const tx = await lotteryContract.write.purchaseTokens([], {
      value: parseEther(amount), // Eth amount sent to buy tokens
      account: signer // Account used specified by the index
    });

    // Wait for the transaction to be mined to ensure it's completed
    const receipt = await publicClient.getTransactionReceipt({ hash: tx });

    console.log(`The account of address ${accounts[Number(index)].account.address} has purchased ${amount} LT0 tokens`);
    
    console.log(`Transaction hash: ${receipt.transactionHash}`);
  } catch (error) {
      console.error("Failed to purchase tokens: ", error);
      throw new Error(`Failed to purchase tokens: ${error.message}`);
  }
}


async function displayTokenBalance(index: string) {
  const accounts = await getAccounts();
  const token = await viem.getContractAt("LotteryToken", tokenAddress);
  const balanceBN = await token.read.balanceOf([
    accounts[Number(index)].account.address,
  ]);
  const balance = formatEther(balanceBN);
  console.log(
    `The account of address ${
      accounts[Number(index)].account.address
    } has ${balance} LT0\n`
  );
}

// Asynchronous function to place a bet using a specified account index
async function bet(index: string) {
  // Get a client to interact with the blockchain
  const publicClient = await getClient();
  // Retrieve an array of accounts available to your script
  const accounts = await getAccounts();
  // Select the specific account based on the index provided; this should be a full account object capable of signing transactions
  const signer = accounts[Number(index)];  

  // Check contracts addresses
  console.log("Lottery Address:", contractAddress);
  console.log("Token Address:", tokenAddress);

  // Connect to the Lottery contract using the specified account to allow actions (transactions) to be taken using this account
  const lotteryContract = await viem.getContractAt("Lottery", contractAddress, signer);
  // Connect to the LotteryToken contract to manage the tokens (e.g., for approval to transfer tokens)
  const tokenContract = await viem.getContractAt("LotteryToken", tokenAddress, signer);



  // Calculate the total amount of tokens needed for the bet by adding the bet price and fee, then converting to Wei (the smallest unit of the token)
  const totalBetAmount = parseEther((parseFloat(BET_PRICE) + parseFloat(BET_FEE)).toString());
  console.log("Total Token Amount for Approval:", totalBetAmount.toString());

  // Log the initiation of the token approval process
  console.log("Approving tokens...");

  // Request approval to allow the Lottery contract to withdraw the specified amount of tokens on behalf of the user
  const approvalTx = await tokenContract.write.approve([
    lotteryContract.address,  // Address of the contract to be allowed to use the tokens
    totalBetAmount // The amount of tokens to approve
  ],           
    { account: signer.account.address }       // Options object specifying which account to perform the transaction
  );

  // Wait for the token approval transaction to be confirmed and log the transaction hash
  const approvalReceipt = await publicClient.getTransactionReceipt({ hash: approvalTx });
  console.log("Approval transaction hash:", approvalReceipt.transactionHash);

  try {
      // Log the initiation of the betting process
      console.log("Placing bet...");
      // Execute the bet function on the Lottery contract with no arguments, specifying the account to use
      const tx = await lotteryContract.write.bet([], { account: signer.account.address });
      // Wait for the bet transaction to be mined and confirmed
      const receipt = await publicClient.getTransactionReceipt({ hash: tx });

      // Log the successful placement of the bet and the transaction hash
      console.log(`The account of address ${signer.account.address} has placed a bet.`);
      console.log("Bet transaction hash:", receipt.transactionHash);
  } catch (error) {
      // If an error occurs, log the error and throw an exception with a message
      console.error("Failed to place bet:", error);
      throw new Error(`Failed to place bet: ${error.message}`);
  }
}





async function closeLottery() {
  // TODO
}

async function displayPrize(index: string) {
  // TODO
  return "TODO";
}

async function claimPrize(index: string, amount: string) {
  // TODO
}

async function displayOwnerPool() {
  // TODO
}

async function withdrawTokens(amount: string) {
  // TODO
}

async function burnTokens(index: string, amount: string) {
  // TODO
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
