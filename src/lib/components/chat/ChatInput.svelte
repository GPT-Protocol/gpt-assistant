<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { ethers } from 'ethers';
  import contractAbi from '../../contracts/gpt.json';
  import { writable } from 'svelte/store';
	import { PUBLIC_GPT_CONTRACT_ADDRESS } from "$env/static/public";
	import { activeAccount } from "$lib/stores/currentAccount";
	import { base } from "$app/paths";

  export let value = "";
  export let minRows = 1;
  export let maxRows: null | number = null;
  export let placeholder = "";
  export let disabled = false;
  const availableCredits = writable(null);
  export let destinationAddress = "0x51e30585e253D8Ed63c04Da77689C97040953105";

  const TABLET_VIEWPORT_WIDTH = 768;

  let innerWidth = 0;
  let textareaElement: HTMLTextAreaElement;
  let provider: ethers.providers.Web3Provider;
  let signer: ethers.providers.JsonRpcSigner;
  let contract: ethers.Contract;

  const dispatch = createEventDispatcher<{ submit: void }>();

  const tokenValuePerToken = 0.017; // Value of each $GPT token in USD
  const creditValuePerToken = 1.00; // Value of each credit in USD

  // Linear regression formula: credits = m * tokens + b
  const linearRegressionSlope = creditValuePerToken / tokenValuePerToken;
  const linearRegressionIntercept = 0;

  let minHeight = "";
  let maxHeight = "";

  async function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      const formattedCredits = Math.floor($availableCredits);
      if (formattedCredits === 0) {
        await purchaseCredits();
        return; // Return early if purchaseCredits was called
      }
      dispatch("submit"); // Emit the submit event
    }
  }

  async function checkTokenBalance(account: any, contractAddress: string) {
    const contract = new ethers.Contract(contractAddress, contractAbi, provider);
    const balance = await contract.balanceOf(account);
    return balance;
  }

  async function connectToMetaMask() {
    try {
      if (typeof window.ethereum !== 'undefined') {
        // Request access to the user's MetaMask accounts
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const account = accounts[0];
        activeAccount.set(account);
        document.cookie = `walletAddress=${account}; path=/; Secure; SameSite=Lax`;
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        // You can perform additional operations after connecting to MetaMask
        // For example, fetch the user's token balance or interact with contracts
      } else {
        alert('Please install MetaMask to proceed.');
      }
    } catch (error) {
      console.error(error);
      alert('Please make sure you are logged into Metamask.');
    }
  }

  async function listenForAccountChanges() {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) {
          // User has logged out, reload the page
          window.location.href = base;
        } else {
          const account = accounts[0];
          document.cookie = `walletAddress=${account}; path=/; Secure; SameSite=Lax`;
          activeAccount.set(account)
          checkAvailableCredits(account);
          window.location.href = base;
        }
      });
    }
  }

  async function checkAvailableCredits() {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const account = accounts[0];
        const contractAddress = PUBLIC_GPT_CONTRACT_ADDRESS;
        const tokenBalance = await checkTokenBalance(account, contractAddress);
        const formattedTokenBalance = ethers.utils.formatUnits(tokenBalance, 18);
        const credits = linearRegressionSlope * formattedTokenBalance + linearRegressionIntercept;
        availableCredits.set(Number(credits.toFixed(2)));
      } else {
        alert('Please install MetaMask to proceed.');
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function purchaseCredits() {
    try {
      const formattedCredits = Math.floor($availableCredits);
      if (formattedCredits < 1) {
        const contractAddress = '0xC3d2675aE844aB277536402c478031770071d9e4';
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const account = accounts[0];
        const contract = new ethers.Contract(contractAddress, contractAbi, provider);
        const balance = await contract.balanceOf(account);
        const amount = ethers.utils.parseUnits("1", 18); // 1 GPT token

        if (balance.gte(amount)) {
          const transaction = await contract.transfer(destinationAddress, amount);
          await transaction.wait();
          alert('Purchase successful!');
        } else {
          alert('Insufficient balance. Please acquire at least 1 $GPT token to enable prompt credits to start a conversation.');
        }
      } else {
        alert('No need to purchase credits. You already have available credits.');
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred while purchasing or verifying prompt credits.');
    }
  }

  onMount(async () => {
    if (innerWidth > TABLET_VIEWPORT_WIDTH) {
      textareaElement.focus();
    }
    await connectToMetaMask();
    await checkAvailableCredits();
    listenForAccountChanges();
  });
</script>

<svelte:window bind:innerWidth />

<div class="relative min-w-0 flex-1">
  <pre
    class="invisible whitespace-pre-wrap p-3"
    aria-hidden="true"
    style="min-height: {minHeight}; max-height: {maxHeight}">{(value || " ") + "\n"}</pre>

  <textarea
    enterkeyhint="send"
    tabindex="0"
    rows="1"
    class="scrollbar-custom absolute top-0 m-0 h-full w-full resize-none scroll-p-3 overflow-x-hidden overflow-y-scroll border-0 bg-transparent p-3 outline-none focus:ring-0 focus-visible:ring-0"
    bind:value
    bind:this={textareaElement}
    {disabled}
    on:keydown={handleKeydown}
    {placeholder}
  />
</div>

{#if $availableCredits !== null}
  <p class="text-center mt-2">Credits: {Math.floor($availableCredits)}</p>
{:else}
  <p class="text-center mt-2">Loading...</p>
{/if}

<style>
  pre,
  textarea {
    font-family: inherit;
    box-sizing: border-box;
    line-height: 1.5;
  }
</style>
