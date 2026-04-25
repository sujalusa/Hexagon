import type {
  LegislationRecord,
  FinanceRecord,
  VotingRecord,
  DataGap,
} from '../types/index.js';

export class DataFetcher {
  async fetchLegislation(billId: string): Promise<LegislationRecord | null> {
    const stubs: Record<string, LegislationRecord> = {
      'HR-1234': {
        billId: 'HR-1234',
        title: 'Infrastructure Investment and Modernization Act',
        fullText:
          'A bill to authorize appropriations for infrastructure improvements including roads, bridges, and broadband access across the United States.',
        statedPurpose:
          'To modernize national infrastructure and expand broadband access to underserved communities.',
        keyProvisions: [
          {
            id: 'HR-1234-P1',
            summary: 'Allocates $200 billion for highway and bridge repair over 5 years.',
            affectedParties: ['state transportation departments', 'contractors', 'commuters'],
          },
          {
            id: 'HR-1234-P2',
            summary: 'Establishes a broadband expansion grant program for rural areas.',
            affectedParties: ['rural residents', 'internet service providers', 'local governments'],
          },
        ],
        affectedParties: ['federal agencies', 'state governments', 'local municipalities', 'private contractors'],
        proceduralStage: 'committee_review',
        glossaryTerms: [
          {
            term: 'appropriations',
            definition: 'Funds authorized by Congress to be spent for specific purposes.',
          },
          {
            term: 'grant program',
            definition: 'A funding mechanism where the government provides money to eligible recipients for a defined purpose without requiring repayment.',
          },
        ],
      },
      'S-5678': {
        billId: 'S-5678',
        title: 'Clean Energy Transition Act',
        fullText:
          'A bill to establish federal standards for renewable energy adoption and provide tax incentives for clean energy investment.',
        statedPurpose:
          'To accelerate the transition to renewable energy sources and reduce carbon emissions from the electricity sector.',
        keyProvisions: [
          {
            id: 'S-5678-P1',
            summary: 'Requires utilities to source 50% of electricity from renewable sources by 2035.',
            affectedParties: ['electric utilities', 'energy consumers', 'renewable energy developers'],
          },
          {
            id: 'S-5678-P2',
            summary: 'Provides a 30% tax credit for residential and commercial solar installations.',
            affectedParties: ['homeowners', 'businesses', 'solar installers'],
          },
        ],
        affectedParties: ['electric utilities', 'energy consumers', 'fossil fuel industry', 'renewable energy sector'],
        proceduralStage: 'floor_vote',
        glossaryTerms: [
          {
            term: 'renewable portfolio standard',
            definition: 'A regulatory mandate requiring a minimum percentage of electricity to come from renewable sources.',
          },
          {
            term: 'tax credit',
            definition: 'A dollar-for-dollar reduction in the amount of tax owed, as opposed to a deduction which reduces taxable income.',
          },
        ],
      },
    };

    return stubs[billId] ?? null;
  }

  async fetchFinanceData(entityId: string): Promise<FinanceRecord | null> {
    const stubs: Record<string, FinanceRecord> = {
      'candidate-001': {
        entityId: 'candidate-001',
        entityName: 'Jane Smith for Senate',
        contributions: [
          {
            donorCategory: 'Individual',
            donorName: 'Various individual donors',
            amount: 1250000,
            date: '2024-06-30',
            disclosureStatus: 'disclosed',
          },
          {
            donorCategory: 'PAC',
            amount: 500000,
            date: '2024-06-30',
            disclosureStatus: 'disclosed',
          },
          {
            donorCategory: 'Small Dollar',
            amount: 320000,
            date: '2024-06-30',
            disclosureStatus: 'disclosed',
          },
        ],
        totalRaised: 2070000,
        reportingPeriod: { start: '2024-01-01', end: '2024-06-30' },
        legalContext:
          'Contributions are subject to Federal Election Commission (FEC) limits. Individual contributions are capped at $3,300 per election cycle. PAC contributions are capped at $5,000 per election.',
        benchmarks: [
          {
            label: 'Average Senate campaign fundraising (same period)',
            value: 1800000,
            description: 'Median fundraising total for competitive Senate races in the same reporting period.',
          },
          {
            label: 'Small-dollar share',
            value: 0.155,
            description: 'Percentage of total funds raised from donations under $200.',
          },
        ],
      },
      'pac-001': {
        entityId: 'pac-001',
        entityName: 'Citizens for Economic Growth PAC',
        contributions: [
          {
            donorCategory: 'Corporate',
            amount: 750000,
            date: '2024-06-30',
            disclosureStatus: 'disclosed',
          },
          {
            donorCategory: 'Individual (large)',
            amount: 400000,
            date: '2024-06-30',
            disclosureStatus: 'disclosed',
          },
        ],
        totalRaised: 1150000,
        reportingPeriod: { start: '2024-01-01', end: '2024-06-30' },
        legalContext:
          'Super PACs may raise unlimited funds from corporations, unions, and individuals but may not donate directly to or coordinate with candidates or parties. Expenditures must be reported to the FEC.',
        benchmarks: [
          {
            label: 'Average Super PAC fundraising (same period)',
            value: 900000,
            description: 'Median fundraising total for active Super PACs in the same reporting period.',
          },
        ],
      },
    };

    return stubs[entityId] ?? null;
  }

  async fetchVotingRecord(politicianId: string): Promise<VotingRecord | null> {
    const stubs: Record<string, VotingRecord> = {
      'rep-001': {
        politicianId: 'rep-001',
        politicianName: 'Rep. Alex Johnson (D-CA)',
        votes: [
          {
            billId: 'HR-1234',
            billTitle: 'Infrastructure Investment and Modernization Act',
            billPurpose: 'To modernize national infrastructure and expand broadband access.',
            policyArea: 'Infrastructure',
            date: '2024-03-15',
            vote: 'yea',
            finalOutcome: 'passed',
          },
          {
            billId: 'HR-9876',
            billTitle: 'Federal Budget Reconciliation Act',
            billPurpose: 'To reconcile discretionary spending levels for fiscal year 2024.',
            policyArea: 'Budget & Appropriations',
            date: '2024-01-20',
            vote: 'nay',
            finalOutcome: 'passed',
          },
        ],
        publicStatements: [
          {
            date: '2024-03-10',
            text: 'This infrastructure bill addresses long-overdue needs in our district and will create jobs.',
            topic: 'Infrastructure',
            relatedBillId: 'HR-1234',
          },
          {
            date: '2024-01-18',
            text: 'The budget proposal does not adequately fund education and social services.',
            topic: 'Budget & Appropriations',
          },
        ],
      },
      'sen-001': {
        politicianId: 'sen-001',
        politicianName: 'Sen. Maria Reyes (R-TX)',
        votes: [
          {
            billId: 'S-5678',
            billTitle: 'Clean Energy Transition Act',
            billPurpose: 'To accelerate the transition to renewable energy sources.',
            policyArea: 'Energy & Environment',
            date: '2024-04-22',
            vote: 'nay',
            finalOutcome: 'failed',
          },
          {
            billId: 'S-1111',
            billTitle: 'Small Business Tax Relief Act',
            billPurpose: 'To provide targeted tax relief for small businesses with fewer than 50 employees.',
            policyArea: 'Taxation',
            date: '2024-02-08',
            vote: 'yea',
            finalOutcome: 'passed',
          },
        ],
        publicStatements: [
          {
            date: '2024-04-20',
            text: 'Mandating renewable energy timelines without considering grid reliability poses risks to consumers.',
            topic: 'Energy & Environment',
            relatedBillId: 'S-5678',
          },
          {
            date: '2024-02-05',
            text: 'Small businesses are the backbone of our economy and deserve targeted relief.',
            topic: 'Taxation',
            relatedBillId: 'S-1111',
          },
        ],
      },
    };

    return stubs[politicianId] ?? null;
  }

  legislationDataGap(): DataGap {
    return {
      description:
        'Legislation data for the requested bill is not currently available. You can look up the full text, status, and history of federal legislation directly through official and nonpartisan sources.',
      primarySources: ['congress.gov', 'govtrack.us', 'legiscan.com'],
    };
  }

  financeDataGap(): DataGap {
    return {
      description:
        'Campaign finance data for the requested entity is not currently available. You can search for contribution and expenditure records through official disclosure databases.',
      primarySources: ['fec.gov', 'opensecrets.org', 'followthemoney.org'],
    };
  }

  votingRecordDataGap(): DataGap {
    return {
      description:
        'Voting record data for the requested politician is not currently available. You can look up voting histories and legislative activity through official and nonpartisan tracking sources.',
      primarySources: ['congress.gov', 'govtrack.us', 'votesmart.org'],
    };
  }
}
