export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: {
      name: string;
    };
    assignee?: {
      displayName: string;
      emailAddress: string;
    };
    priority?: {
      name: string;
    };
    issuetype: {
      name: string;
    };
  };
  self: string;
}

export interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
  maxResults: number;
  startAt: number;
}

export interface JiraErrorResponse {
  errorMessages?: string[];
  errors?: Record<string, string>;
}

export interface IndicatorState {
  type: 'loading' | 'issue' | 'no-issues' | 'error';
  text: string;
  issue?: JiraIssue;
  errorDetails?: string;
}

export interface ExtensionSettings {
  jiraUrl: string;
  jiraEmail: string;
  jiraToken: string;
  jqlQuery: string;
  pollInterval: number;
  issueFormat: string;
  noIssuesText: string;
  panelPosition: number;
  homepageUrl: string;
}