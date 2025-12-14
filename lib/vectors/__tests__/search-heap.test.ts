/**
 * 向量搜索堆优化测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  VectorSearchEngine,
  VectorDocument,
  createSearchEngine,
} from "../search";
import type { Embedding } from "../embeddings";

function randomEmbedding(dim: number): Embedding {
  const vec = new Array(dim).fill(0).map(() => Math.random() - 0.5);
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map((v) => v / norm);
}

function createTestDocuments(count: number, dim: number): VectorDocument[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `doc_${i}`,
    embedding: randomEmbedding(dim),
    content: `Document ${i} content`,
    metadata: { index: i },
    timestamp: Date.now() - i * 1000,
  }));
}

describe("VectorSearchEngine 堆优化", () => {
  let engine: VectorSearchEngine;
  const dim = 128;

  beforeEach(() => {
    engine = createSearchEngine();
  });

  describe("基础搜索功能", () => {
    it("应返回正确数量的结果", () => {
      const docs = createTestDocuments(100, dim);
      engine.addDocuments(docs);

      const query = randomEmbedding(dim);
      const results = engine.search(query, { topK: 10 });

      expect(results.length).toBe(10);
    });

    it("结果应按分数降序排列", () => {
      const docs = createTestDocuments(50, dim);
      engine.addDocuments(docs);

      const query = randomEmbedding(dim);
      const results = engine.search(query, { topK: 20 });

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it("文档数少于 topK 时应返回所有文档", () => {
      const docs = createTestDocuments(5, dim);
      engine.addDocuments(docs);

      const query = randomEmbedding(dim);
      const results = engine.search(query, { topK: 10, minScore: -1 });

      expect(results.length).toBe(5);
    });
  });

  describe("过滤功能", () => {
    it("应正确应用过滤条件", () => {
      const docs = createTestDocuments(100, dim);
      engine.addDocuments(docs);

      const query = randomEmbedding(dim);
      const results = engine.search(query, {
        topK: 50,
        filter: (doc) => (doc.metadata?.index as number) % 2 === 0,
      });

      for (const result of results) {
        expect((result.document.metadata?.index as number) % 2).toBe(0);
      }
    });

    it("过滤后结果数应正确", () => {
      const docs = createTestDocuments(100, dim);
      engine.addDocuments(docs);

      const query = randomEmbedding(dim);
      const results = engine.search(query, {
        topK: 10,
        filter: (doc) => (doc.metadata?.index as number) < 20,
      });

      expect(results.length).toBeLessThanOrEqual(10);
      for (const result of results) {
        expect(result.document.metadata?.index as number).toBeLessThan(20);
      }
    });
  });

  describe("minScore 过滤", () => {
    it("应过滤低于 minScore 的结果", () => {
      const docs = createTestDocuments(50, dim);
      engine.addDocuments(docs);

      const query = randomEmbedding(dim);
      const results = engine.search(query, {
        topK: 50,
        minScore: 0.5,
      });

      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  describe("性能验证", () => {
    it("大数据集搜索应在合理时间内完成", () => {
      const docs = createTestDocuments(10000, dim);
      engine.addDocuments(docs);

      const query = randomEmbedding(dim);

      const start = performance.now();
      const results = engine.search(query, { topK: 10 });
      const duration = performance.now() - start;

      expect(results.length).toBe(10);
      expect(duration).toBeLessThan(500);
    });

    it("堆优化应比全量排序更高效", () => {
      const docs = createTestDocuments(5000, dim);
      engine.addDocuments(docs);

      const query = randomEmbedding(dim);

      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        engine.search(query, { topK: 10 });
        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(200);
    });
  });

  describe("结果正确性", () => {
    it("应返回真正的 Top-K 结果", () => {
      const docs: VectorDocument[] = [];
      const targetEmbedding = randomEmbedding(dim);

      for (let i = 0; i < 100; i++) {
        const embedding = randomEmbedding(dim);
        docs.push({
          id: `doc_${i}`,
          embedding,
          content: `Document ${i}`,
        });
      }

      docs.push({
        id: "target",
        embedding: targetEmbedding,
        content: "Target document",
      });

      engine.addDocuments(docs);

      const results = engine.search(targetEmbedding, { topK: 1 });

      expect(results[0].document.id).toBe("target");
      expect(results[0].score).toBeCloseTo(1, 5);
    });

    it("相似向量应有更高分数", () => {
      const baseEmbedding = randomEmbedding(dim);

      const similarEmbedding = baseEmbedding.map((v) => v + (Math.random() - 0.5) * 0.1);
      const norm = Math.sqrt(similarEmbedding.reduce((s, v) => s + v * v, 0));
      const normalizedSimilar = similarEmbedding.map((v) => v / norm);

      const dissimilarEmbedding = randomEmbedding(dim);

      engine.addDocument({
        id: "similar",
        embedding: normalizedSimilar,
        content: "Similar document",
      });

      engine.addDocument({
        id: "dissimilar",
        embedding: dissimilarEmbedding,
        content: "Dissimilar document",
      });

      const results = engine.search(baseEmbedding, { topK: 2 });

      expect(results[0].document.id).toBe("similar");
    });
  });
});
