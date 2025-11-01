import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeStyling } from 'qr-code-styling';
import { breezService } from '../../services/breezService';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Invoice {
  bolt11: string;
  paymentHash: string;
  amountMsat?: number;
  description?: string;
  expiryTimestamp: number;
  status: 'pending' | 'paid';
  amountReceivedMsat?: number;
}

const ReceiveModal: React.FC<ReceiveModalProps> = ({ isOpen, onClose }) => {
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [expiryTime, setExpiryTime] = useState<string>('1h');
  const [customExpiry, setCustomExpiry] = useState<string>('');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [qrCode, setQrCode] = useState<QRCodeStyling | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // Initialize QR code styling
  useEffect(() => {
    if (invoice?.bolt11) {
      const qr = new QRCodeStyling({
        width: 256,
        height: 256,
        type: 'svg',
        data: invoice.bolt11,
        dotsOptions: {
          color: '#000000',
          type: 'rounded'
        },
        cornersSquareOptions: {
          color: '#000000',
          type: 'extra-rounded'
        },
        cornersDotOptions: {
          color: '#000000',
          type: 'dot'
        },
        backgroundOptions: {
          color: '#ffffff'
        }
      });
      setQrCode(qr);
    }
  }, [invoice?.bolt11]);

  // Poll for invoice status
  const pollInvoiceStatus = useCallback(async (paymentHash: string) => {
    if (!isPolling) return;
    
    try {
      const status = await breezService.getInvoiceStatus(paymentHash);
      if (status.status === 'paid') {
        setInvoice(prev => prev ? {
          ...prev,
          status: 'paid',
          amountReceivedMsat: status.amountReceivedMsat
        } : null);
        setIsPolling(false);
      }
    } catch (error) {
      console.error('Error polling invoice status:', error);
    }
  }, [isPolling]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (invoice && invoice.status === 'pending' && isPolling) {
      intervalId = setInterval(() => {
        pollInvoiceStatus(invoice.paymentHash);
      }, 2000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [invoice, isPolling, pollInvoiceStatus]);

  const getExpirySeconds = (): number => {
    switch (expiryTime) {
      case '1h': return 3600;
      case '6h': return 21600;
      case '24h': return 86400;
      case 'custom': return parseInt(customExpiry) * 60 || 3600;
      default: return 3600;
    }
  };

  const handleGenerateInvoice = async () => {
    setIsGenerating(true);
    try {
      const amountMsat = amount ? parseInt(amount) * 1000 : undefined;
      const expirySeconds = getExpirySeconds();
      
      const newInvoice = await breezService.createInvoice({
        amountMsat,
        description,
        expirySeconds
      });
      
      setInvoice({
        bolt11: newInvoice.bolt11,
        paymentHash: newInvoice.paymentHash,
        amountMsat,
        description,
        expiryTimestamp: Date.now() + (expirySeconds * 1000),
        status: 'pending'
      });
      
      setIsPolling(true);
    } catch (error) {
      console.error('Error generating invoice:', error);
      alert('Failed to generate invoice. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyInvoice = async () => {
    if (invoice?.bolt11) {
      try {
        await navigator.clipboard.writeText(invoice.bolt11);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (error) {
        console.error('Failed to copy invoice:', error);
      }
    }
  };

  const handleShare = async () => {
    if (invoice?.bolt11 && navigator.share) {
      try {
        await navigator.share({
          title: 'Lightning Invoice',
          text: `Payment request: ${invoice.bolt11}`,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  const formatAmount = (amountMsat: number): string => {
    return (amountMsat / 1000).toLocaleString();
  };

  const isExpired = (): boolean => {
    return invoice ? Date.now() > invoice.expiryTimestamp : false;
  };

  const handleClose = () => {
    setIsPolling(false);
    setInvoice(null);
    setAmount('');
    setDescription('');
    setExpiryTime('1h');
    setCustomExpiry('');
    setCopySuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Receive Payment</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {!invoice ? (
          <div className="space-y-4">
            {/* Amount Input */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount (sats) - Optional
              </label>
              <input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Leave empty for any amount"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Description Field */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description/Memo
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this payment for?"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Expiry Time Selector */}
            <div>
              <label htmlFor="expiry" className="block text-sm font-medium text-gray-700 mb-1">
                Expiry Time
              </label>
              <select
                id="expiry"
                value={expiryTime}
                onChange={(e) => setExpiryTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1h">1 hour</option>
                <option value="6h">6 hours</option>
                <option value="24h">24 hours</option>
                <option value="custom">Custom</option>
              </select>
              
              {expiryTime === 'custom' && (
                <input
                  type="number"
                  value={customExpiry}
                  onChange={(e) => setCustomExpiry(e.target.value)}
                  placeholder="Minutes"
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateInvoice}
              disabled={isGenerating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {isGenerating ? 'Generating...' : 'Generate Invoice'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Invoice Status */}
            <div className="flex items-center justify-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                invoice.status === 'paid' ? 'bg-green-500' :
                isExpired() ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
              <span className={`font-medium ${
                invoice.status === 'paid' ? 'text-green-600' :
                isExpired() ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {invoice.status === 'paid' ? 'Paid' :
                 isExpired() ? 'Expired' : 'Pending'}
              </span>
            </div>

            {/* Amount Display */}
            {invoice.amountMsat && (
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800">
                  {formatAmount(invoice.amountMsat)} sats
                </div>
                {invoice.status === 'paid' && invoice.amountReceivedMsat && (
                  <div className="text-sm text-green-600">
                    Received: {formatAmount(invoice.amountReceivedMsat)} sats
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {invoice.description && (
              <div className="text-center text-gray-600">
                {invoice.description}
              </div>
            )}

            {/* QR Code */}
            <div className="flex justify-center">
              <div 
                ref={(ref) => {
                  if (ref && qrCode) {
                    ref.innerHTML = '';
                    qrCode.append(ref);
                  }
                }}
                className="border-2 border-gray-200 rounded-lg p-2"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleCopyInvoice}
                className={`w-full font-medium py-2 px-4 rounded-md transition-colors ${
                  copySuccess 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                {copySuccess ? 'Copied!' : 'Copy Invoice'}
              </button>
              
              {navigator.share && (
                <button
                  onClick={handleShare}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Share Invoice
                </button>
              )}
            </div>

            {/* New Invoice Button */}
            <button
              onClick={() => setInvoice(null)}
              className="w-full bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
            >
              Create New Invoice
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiveModal;
