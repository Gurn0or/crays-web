#!/bin/bash

# Automated Breez SDK Integration Test Script
# Tests all components of Breez SDK installation and configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TEST_COUNT=0
PASSED_COUNT=0
FAILED_COUNT=0

# Function to print test results
print_test_result() {
    local test_name="$1"
    local result="$2"
    local message="$3"
    
    TEST_COUNT=$((TEST_COUNT + 1))
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}[PASS]${NC} Test $TEST_COUNT: $test_name"
        [ -n "$message" ] && echo "       $message"
        PASSED_COUNT=$((PASSED_COUNT + 1))
    else
        echo -e "${RED}[FAIL]${NC} Test $TEST_COUNT: $test_name"
        [ -n "$message" ] && echo "       $message"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
}

echo "=========================================="
echo "Breez SDK Integration Test Suite"
echo "=========================================="
echo ""

# Test 1: Project Directory Check
echo "Running Test 1: Project Directory Check..."
if [ -f "package.json" ] && [ -d "src" ]; then
    print_test_result "Project Directory Check" "PASS" "package.json and src directory found"
else
    print_test_result "Project Directory Check" "FAIL" "Missing package.json or src directory"
fi

# Test 2: Node.js Version
echo "Running Test 2: Node.js Version Check..."
NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
if [[ "$NODE_VERSION" =~ ^v(1[8-9]|[2-9][0-9]) ]]; then
    print_test_result "Node.js Version" "PASS" "Node.js $NODE_VERSION detected"
else
    print_test_result "Node.js Version" "FAIL" "Node.js 18+ required, found: $NODE_VERSION"
fi

# Test 3: Dependencies Check
echo "Running Test 3: Dependencies Installation Check..."
if [ -f "package.json" ]; then
    BREEZ_SDK_WEB=$(grep -c '"@breeztech/react-native-breez-sdk-wasm"' package.json || true)
    VITE_PLUGIN=$(grep -c '"vite-plugin-wasm"' package.json || true)
    VITE_PLUGIN_TOP=$(grep -c '"vite-plugin-top-level-await"' package.json || true)
    
    if [ $BREEZ_SDK_WEB -gt 0 ] && [ $VITE_PLUGIN -gt 0 ] && [ $VITE_PLUGIN_TOP -gt 0 ]; then
        print_test_result "Dependencies Check" "PASS" "All required dependencies found in package.json"
    else
        print_test_result "Dependencies Check" "FAIL" "Missing dependencies in package.json"
    fi
else
    print_test_result "Dependencies Check" "FAIL" "package.json not found"
fi

# Test 4: Breez SDK Installation
echo "Running Test 4: Breez SDK Installation Verification..."
if [ -d "node_modules/@breeztech/react-native-breez-sdk-wasm" ]; then
    print_test_result "Breez SDK Installation" "PASS" "Breez SDK package installed in node_modules"
else
    print_test_result "Breez SDK Installation" "FAIL" "Breez SDK package not found in node_modules"
fi

# Test 5: WASM Plugins Check
echo "Running Test 5: WASM Plugins Check..."
if [ -d "node_modules/vite-plugin-wasm" ] && [ -d "node_modules/vite-plugin-top-level-await" ]; then
    print_test_result "WASM Plugins Check" "PASS" "Both WASM plugins installed"
else
    print_test_result "WASM Plugins Check" "FAIL" "WASM plugins not properly installed"
fi

# Test 6: Crypto Libraries Check
echo "Running Test 6: Crypto Libraries Check..."
CRYPTO_LIBS_FOUND=0
if [ -d "node_modules/crypto-browserify" ]; then
    ((CRYPTO_LIBS_FOUND++))
fi
if [ -d "node_modules/stream-browserify" ]; then
    ((CRYPTO_LIBS_FOUND++))
fi
if [ -d "node_modules/buffer" ]; then
    ((CRYPTO_LIBS_FOUND++))
fi

if [ $CRYPTO_LIBS_FOUND -eq 3 ]; then
    print_test_result "Crypto Libraries Check" "PASS" "All crypto polyfills installed"
else
    print_test_result "Crypto Libraries Check" "FAIL" "Missing crypto polyfills ($CRYPTO_LIBS_FOUND/3 found)"
fi

# Test 7: Created Files Check
echo "Running Test 7: Created Files Check..."
FILES_FOUND=0
[ -f "src/lib/breez.ts" ] && ((FILES_FOUND++))
[ -f "src/lib/zap.ts" ] && ((FILES_FOUND++))

if [ $FILES_FOUND -eq 2 ]; then
    print_test_result "Created Files Check" "PASS" "breez.ts and zap.ts files exist"
else
    print_test_result "Created Files Check" "FAIL" "Missing breez.ts or zap.ts ($FILES_FOUND/2 found)"
fi

# Test 8: .env Configuration Check
echo "Running Test 8: .env Configuration Check..."
if [ -f ".env" ]; then
    ENV_VARS_FOUND=0
    grep -q "VITE_BREEZ_API_KEY" .env && ((ENV_VARS_FOUND++))
    grep -q "VITE_GREENLIGHT_PARTNER_CERT" .env && ((ENV_VARS_FOUND++))
    grep -q "VITE_GREENLIGHT_PARTNER_KEY" .env && ((ENV_VARS_FOUND++))
    
    if [ $ENV_VARS_FOUND -eq 3 ]; then
        print_test_result ".env Configuration" "PASS" "All required environment variables defined"
    else
        print_test_result ".env Configuration" "FAIL" "Missing environment variables ($ENV_VARS_FOUND/3 found)"
    fi
else
    print_test_result ".env Configuration" "FAIL" ".env file not found"
fi

# Test 9: vite.config.ts Settings Check
echo "Running Test 9: vite.config.ts Configuration Check..."
if [ -f "vite.config.ts" ]; then
    CONFIG_ITEMS=0
    grep -q "vite-plugin-wasm" vite.config.ts && ((CONFIG_ITEMS++))
    grep -q "vite-plugin-top-level-await" vite.config.ts && ((CONFIG_ITEMS++))
    grep -q "crypto" vite.config.ts && ((CONFIG_ITEMS++))
    grep -q "stream" vite.config.ts && ((CONFIG_ITEMS++))
    grep -q "buffer" vite.config.ts && ((CONFIG_ITEMS++))
    
    if [ $CONFIG_ITEMS -ge 4 ]; then
        print_test_result "vite.config.ts Settings" "PASS" "Vite config properly configured"
    else
        print_test_result "vite.config.ts Settings" "FAIL" "Incomplete vite.config.ts configuration"
    fi
else
    print_test_result "vite.config.ts Settings" "FAIL" "vite.config.ts not found"
fi

# Test 10: App.tsx Integration Check
echo "Running Test 10: App.tsx Integration Check..."
if [ -f "src/App.tsx" ]; then
    APP_ITEMS=0
    grep -q "breez" src/App.tsx && ((APP_ITEMS++))
    grep -q "initBreezSDK\|connectBreezSDK\|breezSDK" src/App.tsx && ((APP_ITEMS++))
    
    if [ $APP_ITEMS -ge 1 ]; then
        print_test_result "App.tsx Integration" "PASS" "Breez SDK integrated in App.tsx"
    else
        print_test_result "App.tsx Integration" "FAIL" "No Breez SDK integration found in App.tsx"
    fi
else
    print_test_result "App.tsx Integration" "FAIL" "src/App.tsx not found"
fi

# Test 11: Build Process Check
echo "Running Test 11: Build Process Check..."
if command -v npm &> /dev/null; then
    echo "       Attempting build (this may take a moment)..."
    if npm run build &> /tmp/breez-build.log; then
        if [ -d "dist" ]; then
            print_test_result "Build Process" "PASS" "Project builds successfully"
        else
            print_test_result "Build Process" "FAIL" "Build succeeded but dist directory not found"
        fi
    else
        print_test_result "Build Process" "FAIL" "Build failed (check /tmp/breez-build.log)"
    fi
else
    print_test_result "Build Process" "FAIL" "npm command not found"
fi

# Test 12: Zap Integration Check
echo "Running Test 12: Zap Integration Check..."
if [ -f "src/lib/zap.ts" ]; then
    ZAP_ITEMS=0
    grep -q "sendPayment\|payInvoice\|generateInvoice" src/lib/zap.ts && ((ZAP_ITEMS++))
    grep -q "breez" src/lib/zap.ts && ((ZAP_ITEMS++))
    
    if [ $ZAP_ITEMS -ge 2 ]; then
        print_test_result "Zap Integration" "PASS" "Zap functionality properly integrated"
    else
        print_test_result "Zap Integration" "FAIL" "Incomplete zap integration"
    fi
else
    print_test_result "Zap Integration" "FAIL" "src/lib/zap.ts not found"
fi

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Total Tests: $TEST_COUNT"
echo -e "${GREEN}Passed: $PASSED_COUNT${NC}"
echo -e "${RED}Failed: $FAILED_COUNT${NC}"

if [ $FAILED_COUNT -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
