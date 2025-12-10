"use client";

/**
 * Script Runner Test Page
 * 
 * Basic test to verify the script executor functionality
 */

import { useState } from "react";
import { ScriptExecutor } from "@/lib/script-runner/executor";

export default function ScriptRunnerTest() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  
  const runTest = async () => {
    setLoading(true);
    setResult("Running test...\n");
    let executor: ScriptExecutor | null = null;
    
    try {
      executor = new ScriptExecutor({
        timeout: 5000,
        allowConsole: true,
      });
      
      // Test 1: Basic execution
      setResult(prev => prev + "\n[Test 1] Basic execution...\n");
      const result1 = await executor.execute(`
        DreamMiniStage.utils.log('Hello from sandbox!');
        return 1 + 1;
      `);
      setResult(prev => prev + `Result: ${JSON.stringify(result1, null, 2)}\n`);
      
      // Test 2: Variable access
      setResult(prev => prev + "\n[Test 2] Variable access...\n");
      const result2 = await executor.execute(`
        DreamMiniStage.variables.set('testVar', 'Hello World');
        return DreamMiniStage.variables.get('testVar');
      `, {
        variables: {},
      });
      setResult(prev => prev + `Result: ${JSON.stringify(result2, null, 2)}\n`);
      
      // Test 3: Async operation
      setResult(prev => prev + "\n[Test 3] Async operation...\n");
      const result3 = await executor.execute(`
        await DreamMiniStage.utils.waitFor(1000);
        return 'Waited 1 second';
      `);
      setResult(prev => prev + `Result: ${JSON.stringify(result3, null, 2)}\n`);
      
      // Test 4: Error handling
      setResult(prev => prev + "\n[Test 4] Error handling...\n");
      const result4 = await executor.execute(`
        throw new Error('Test error');
      `);
      setResult(prev => prev + `Result: ${JSON.stringify(result4, null, 2)}\n`);
      
      setResult(prev => prev + "\n✅ All tests completed!\n");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResult(prev => prev + `\n❌ Error: ${message}\n`);
    } finally {
      if (executor) executor.destroy();
      setLoading(false);
    }
  };
  
  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>Script Runner Test</h1>
      <button 
        onClick={runTest}
        disabled={loading}
        style={{
          padding: "10px 20px",
          fontSize: "16px",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Running..." : "Run Tests"}
      </button>
      
      <pre style={{
        background: "#f5f5f5",
        padding: "15px",
        marginTop: "20px",
        borderRadius: "4px",
        maxHeight: "600px",
        overflow: "auto",
      }}>
        {result || "Click \"Run Tests\" to start"}
      </pre>
    </div>
  );
}
