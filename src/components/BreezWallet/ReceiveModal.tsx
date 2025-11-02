import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeStyling } from 'qr-code-styling';
import { getBreezService } from '../../lib/breez/breezService';

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
        data: invoice.bolt11.toLowerCase(),
        dotsOptions: {
          color: '#000000',
          type: 'rounded',
        },
        cornersSquareOptions: {
          color: '#000000',
          type: 'extra-rounded',
        },
        cornersDotOptions: {
          color: '#000000',
          type: 'dot',
        },
      });

      setQrCode(qr);

      // Render QR code
      const container = document.getElementById('qr-code-container');
      if (container) {
        container.innerHTML = '';
        qr.append(container);
      }
    }
  }, [invoice?.bolt11]);

  // Polling for invoice status
  const pollInvoiceStatus = useCallback(async (paymentHash: string) => {
    if (!isPolling) return;

    try {
      const status = await getBreezService().getInvoiceStatus(paymentHash);

      if (status.status === 'paid') {
        setInvoice((prev) => 
          prev ? { ...prev, status: 'paid', amountReceivedMsat: status.amountReceivedMsat } : null
        );
        setIsPolling(false);
      }
    } catch (error) {
      console.error('Error polling invoice status:', error);
    }
  }, [isPolling]);

  useEffect(() => {
    if (!invoice || !isPolling) return;

    const interval = setInterval(() => {
      pollInvoiceStatus(invoice.paymentHash);
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [invoice, isPolling, pollInvoiceStatus]);

  const getExpiryInSeconds = (): number => {
    if (expiryTime === 'custom') {
      const value = parseInt(customExpiry);
      return isNaN(value) ? 3600 : value * 60; // Convert minutes to seconds
    }

    const timeMap: { [key: string]: number } = {
      '10m': 600,
      '30m': 1800,
      '1h': 3600,
      '24h': 86400,
    };

    return timeMap[expiryTime] || 3600;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const amountMsat = amount ? parseInt(amount) * 1000 : undefined;
      const expirySeconds = getExpiryInSeconds();

      const newInvoice = await getBreezService().createInvoice({
        amountMsat,
        description: description || 'Lightning Invoice',
        expirySeconds,
      });

      setInvoice({
        bolt11: newInvoice.bolt11,
        paymentHash: newInvoice.paymentHash,
        amountMsat: newInvoice.amountMsat,
        description: newInvoice.description,
        expiryTimestamp: Date.now() + expirySeconds * 1000,
        status: 'pending',
      });

      setIsPolling(true);
    } catch (error) {
      console.error('Error generating invoice:', error);
      alert('Failed to generate invoice. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleReset = () => {
    setInvoice(null);
    setAmount('');
    setDescription('');
    setExpiryTime('1h');
    setCustomExpiry('');
    setIsPolling(false);
    setCopySuccess(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {invoice ? 'Lightning Invoice' : 'Create Invoice'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {!invoice ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Amount (sats)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this for?"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Expires in
              </label>
              <select
                value={expiryTime}
                onChange={(e) => setExpiryTime(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="10m">10 minutes</option>
                <option value="30m">30 minutes</option>
                <option value="1h">1 hour</option>
                <option value="24h">24 hours</option>
                <option value="custom">Custom</option>
              </select>

              {expiryTime === 'custom' && (
                <input
                  type="number"
                  value={customExpiry}
                  onChange={(e) => setCustomExpiry(e.target.value)}
                  placeholder="Minutes"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
                />
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isGenerating ? 'Generating...' : 'Generate Invoice'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div id="qr-code-container" className="bg-white p-4 rounded-lg" />
            </div>

            {invoice.status === 'paid' && (
              <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg text-center">
                ✓ Payment Received!
                {invoice.amountReceivedMsat && (
                  <div className="text-sm">
                    {Math.floor(invoice.amountReceivedMsat / 1000)} sats
                  </div>
                )}
              </div>
            )}

            {invoice.status === 'pending' && (
              <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg text-center">
                Waiting for payment...
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Invoice</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={invoice.bolt11}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-sm"
                />
                <button
                  onClick={() => handleCopy(invoice.bolt11)}
                  className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  {copySuccess ? '✓' : 'Copy'}
                </button>
              </div>
            </div>

            {invoice.description && (
              <div className="text-sm text-gray-600">
                <strong>Description:</strong> {invoice.description}
              </div>
            )}

            {invoice.amountMsat && (
              <div className="text-sm text-gray-600">
                <strong>Amount:</strong> {Math.floor(invoice.amountMsat / 1000)} sats
              </div>
            )}

            <button
              onClick={handleReset}
              className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
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
