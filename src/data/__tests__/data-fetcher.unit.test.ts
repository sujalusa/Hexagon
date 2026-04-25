import { describe, it, expect } from 'vitest';
import { DataFetcher } from '../DataFetcher.js';

describe('DataFetcher', () => {
  const fetcher = new DataFetcher();

  // Unknown ID tests
  it('fetchLegislation with unknown ID returns null', async () => {
    const result = await fetcher.fetchLegislation('UNKNOWN-999');
    expect(result).toBeNull();
  });

  it('fetchFinanceData with unknown ID returns null', async () => {
    const result = await fetcher.fetchFinanceData('unknown-entity');
    expect(result).toBeNull();
  });

  it('fetchVotingRecord with unknown ID returns null', async () => {
    const result = await fetcher.fetchVotingRecord('unknown-politician');
    expect(result).toBeNull();
  });

  // DataGap tests
  it('legislationDataGap returns a DataGap with non-empty description and primarySources', () => {
    const gap = fetcher.legislationDataGap();
    expect(gap.description).toBeTruthy();
    expect(gap.primarySources.length).toBeGreaterThanOrEqual(1);
  });

  it('financeDataGap returns a DataGap with non-empty description and primarySources', () => {
    const gap = fetcher.financeDataGap();
    expect(gap.description).toBeTruthy();
    expect(gap.primarySources.length).toBeGreaterThanOrEqual(1);
  });

  it('votingRecordDataGap returns a DataGap with non-empty description and primarySources', () => {
    const gap = fetcher.votingRecordDataGap();
    expect(gap.description).toBeTruthy();
    expect(gap.primarySources.length).toBeGreaterThanOrEqual(1);
  });

  // Known ID tests
  it('fetchLegislation with known bill ID returns a LegislationRecord', async () => {
    const result = await fetcher.fetchLegislation('HR-1234');
    expect(result).not.toBeNull();
    expect(result?.billId).toBe('HR-1234');
  });

  it('fetchFinanceData with known entity ID returns a FinanceRecord', async () => {
    const result = await fetcher.fetchFinanceData('candidate-001');
    expect(result).not.toBeNull();
    expect(result?.entityId).toBe('candidate-001');
  });

  it('fetchVotingRecord with known politician ID returns a VotingRecord', async () => {
    const result = await fetcher.fetchVotingRecord('rep-001');
    expect(result).not.toBeNull();
    expect(result?.politicianId).toBe('rep-001');
  });
});
