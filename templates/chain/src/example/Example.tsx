import React, { useEffect, useState } from 'react'
import './Example.css'
import { ethers } from 'ethers'
import { AlphaRouter, ChainId, SwapType } from '@uniswap/smart-order-router'
import { TradeType, CurrencyAmount, Percent } from '@uniswap/sdk-core'
import { Environment, CurrentConfig } from '../config'
import { getCurrencyBalance } from '../libs/wallet'
import { V3_SWAP_ROUTER_ADDRESS } from '../libs/addresses'
import {
  connectWallet,
  getMainnetProvider,
  getProvider,
  getWalletAddress,
  sendTransaction,
  TransactionState,
} from '../libs/provider'

async function route(): Promise<TransactionState> {
  const router = new AlphaRouter({ chainId: ChainId.MAINNET, provider: getMainnetProvider() })
  const address = getWalletAddress()

  if (!address) {
    return TransactionState.Failed
  }

  const route = await router.route(
    CurrencyAmount.fromRawAmount(
      CurrentConfig.currencies.tokenIn,
      ethers.utils.parseEther(CurrentConfig.currencies.amountIn.toString()).toString()
    ),
    CurrentConfig.currencies.tokenOut,
    TradeType.EXACT_INPUT,
    {
      recipient: CurrentConfig.wallet.address,
      slippageTolerance: new Percent(5, 100),
      deadline: Math.floor(Date.now() / 1000 + 1800),
      type: SwapType.SWAP_ROUTER_02,
    }
  )

  const res = await sendTransaction({
    data: route?.methodParameters?.calldata,
    to: V3_SWAP_ROUTER_ADDRESS,
    value: route?.methodParameters?.value,
    from: address,
    gasLimit: 300000,
  })

  return res
}

function Example() {
  const [tokenInBalance, setTokenInBalance] = useState<string>()
  const [tokenOutBalance, setTokenOutBalance] = useState<string>()
  const [txState, setTxState] = useState<TransactionState>(TransactionState.New)
  const [blockNumber, setBlockNumber] = useState<number>(0)

  // Event Handlers

  const onConnectWallet = async () => {
    await connectWallet()
    if (getWalletAddress()) {
      refreshBalances()
    }
  }

  const onTrade = async () => {
    setTxState(TransactionState.Sending)
    setTxState(await route())
  }

  // Update wallet state given a block number
  const refreshBalances = async () => {
    const provider = getProvider()
    const address = getWalletAddress()
    if (address && provider) {
      setTokenInBalance(await getCurrencyBalance(provider, address, CurrentConfig.currencies.tokenIn))
      setTokenOutBalance(await getCurrencyBalance(provider, address, CurrentConfig.currencies.tokenOut))
    }
  }

  // Listen for new blocks and update the wallet
  useEffect(() => {
    const subscription = getProvider()?.on('block', async (blockNumber: number) => {
      refreshBalances()
      setBlockNumber(blockNumber)
    })
    return () => {
      subscription?.removeAllListeners()
    }
  }, [])

  return (
    <div className="App">
      <header className="App-header">
        {CurrentConfig.env === Environment.WALLET_EXTENSION && getProvider() === null && (
          <h1 className="error">Please install a wallet to use this example configuration</h1>
        )}
        <h3>{`Wallet Address: ${getWalletAddress()}`}</h3>
        {CurrentConfig.env === Environment.WALLET_EXTENSION && (
          <button onClick={onConnectWallet}>Connect Wallet</button>
        )}
        <h3>{`Block Number: ${blockNumber + 1}`}</h3>
        <h3>{`Transaction State: ${txState}`}</h3>
        <h3>{`Token In (ETH) Balance: ♦${tokenInBalance}`}</h3>
        <h3>{`Token Out (USDC) Balance: $${tokenOutBalance}`}</h3>
        <button onClick={onTrade} disabled={txState === TransactionState.Sending || getProvider() === null}>
          <p>Trade</p>
        </button>
      </header>
    </div>
  )
}

export default Example