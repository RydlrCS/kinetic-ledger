import React, { useState } from 'react';
import { Wallet, DollarSign, History, Plus, Send, Circle, ExternalLink } from 'lucide-react';

interface Transaction {
  id: string;
  type: 'mint' | 'reward' | 'transfer';
  description: string;
  amount: string;
  timestamp: Date;
  status: 'completed' | 'pending';
}

interface WalletPanelProps {
  isConnected: boolean;
  walletAddress?: string;
  balance: string;
  onConnect: () => void;
  onDisconnect: () => void;
  transactions: Transaction[];
}

export default function WalletPaymentPanel({
  isConnected,
  walletAddress,
  balance,
  onConnect,
  onDisconnect,
  transactions,
}: WalletPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'mint':
        return <Circle className="w-4 h-4 text-purple-500" />;
      case 'reward':
        return <DollarSign className="w-4 h-4 text-green-500" />;
      case 'transfer':
        return <Send className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <>
      {/* Header Wallet Button */}
      <div className="fixed top-4 right-4 z-50">
        {!isConnected ? (
          <button
            onClick={onConnect}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-semibold rounded-full shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
          >
            <Wallet className="w-5 h-5" />
            <span>Connect Wallet</span>
          </button>
        ) : (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-3 px-4 py-3 bg-white/95 backdrop-blur-sm hover:bg-white border-2 border-blue-200 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
          >
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="font-mono font-semibold text-gray-900">{shortAddress}</span>
            <div className="text-sm font-semibold text-blue-600">{balance} USDC</div>
          </button>
        )}
      </div>

      {/* Wallet Panel Sidebar */}
      {isConnected && (
        <>
          {/* Backdrop */}
          {isOpen && (
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
              onClick={() => setIsOpen(false)}
            />
          )}

          {/* Sliding Panel */}
          <div
            className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
              isOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-6 bg-gradient-to-br from-blue-500 to-teal-500 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm opacity-80">Connected Wallet</div>
                      <div className="font-mono text-sm">{shortAddress}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  >
                    <span className="text-xl">×</span>
                  </button>
                </div>

                {/* Balance Display */}
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-sm opacity-80 mb-1">USDC Balance</div>
                  <div className="text-4xl font-bold">{balance}</div>
                  <div className="text-sm opacity-80 mt-1">≈ ${balance} USD</div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 border-b border-gray-200">
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex flex-col items-center space-y-2 p-4 bg-gradient-to-br from-blue-50 to-teal-50 hover:from-blue-100 hover:to-teal-100 rounded-xl transition-colors border border-blue-200">
                    <Plus className="w-6 h-6 text-blue-600" />
                    <span className="text-sm font-medium text-gray-800">Add USDC</span>
                  </button>
                  
                  <button className="flex flex-col items-center space-y-2 p-4 bg-gradient-to-br from-gray-50 to-blue-50 hover:from-gray-100 hover:to-blue-100 rounded-xl transition-colors border border-gray-200">
                    <Send className="w-6 h-6 text-gray-600" />
                    <span className="text-sm font-medium text-gray-800">Withdraw</span>
                  </button>
                </div>
              </div>

              {/* Fee Info */}
              <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Minting Fee:</span>
                  <span className="font-semibold text-gray-900">7 USDC per token</span>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  Powered by Arc • Fast finality • Low fees in USDC
                </div>
              </div>

              {/* Recent Activity */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <History className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-900">Recent Activity</h3>
                </div>

                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No transactions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
                      >
                        <div className="flex items-start space-x-3">
                          {getTransactionIcon(tx.type)}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">
                              {tx.description}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {tx.timestamp.toLocaleString()}
                            </div>
                          </div>
                          <div className={`text-sm font-semibold whitespace-nowrap ${
                            tx.amount.startsWith('+') ? 'text-green-600' : 'text-gray-900'
                          }`}>
                            {tx.amount} USDC
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 space-y-3">
                <button className="w-full flex items-center justify-center space-x-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <ExternalLink className="w-4 h-4" />
                  <span>View on Arc Explorer</span>
                </button>
                
                <button
                  onClick={onDisconnect}
                  className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors"
                >
                  Disconnect Wallet
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
