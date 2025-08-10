import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import {JiraIssue, JiraSearchResponse, JiraErrorResponse, ExtensionSettings} from './types.js';

export class JiraService {
    private session: Soup.Session;
    private settings: ExtensionSettings;

    constructor(settings: ExtensionSettings) {
        this.session = new Soup.Session();
        this.settings = settings;
    }

    updateSettings(settings: ExtensionSettings) {
        this.settings = settings;
    }

    async searchIssues(): Promise<JiraIssue[]> {
        if (!this.settings.jiraUrl || !this.settings.jiraEmail || !this.settings.jiraToken) {
            throw new Error('Jira URL, email, and token must be configured');
        }

        const queryParts = [
            `jql=${encodeURIComponent(this.settings.jqlQuery)}`,
            'maxResults=1',
            'fields=key,summary,status,assignee,priority,issuetype'
        ];
        
        // Normalize the Jira URL
        let baseUrl = this.settings.jiraUrl.trim();
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
            baseUrl = `https://${baseUrl}`;
        }
        if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }
        
        const url = `${baseUrl}/rest/api/2/search?${queryParts.join('&')}`;
        
        // Basic URL format validation
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            throw new Error(`Invalid Jira URL format: ${url}`);
        }
        
        let message;
        try {
            console.log('JiraService: Attempting to create Soup message...');
            message = Soup.Message.new('GET', url);
            console.log('JiraService: Message created, checking if valid...');
        } catch (error) {
            console.error('JiraService: Failed to create Soup message:', error);
            if (error instanceof Error) {
                console.error('JiraService: Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
            }
            throw new Error(`Failed to create HTTP message: ${error}`);
        }

        if (!message) {
            console.error('JiraService: Message is null after creation');
            throw new Error('Failed to create HTTP message - Soup.Message.new returned null');
        }

        // Set headers
        const requestHeaders = message.get_request_headers();
        
        // Use Basic Authentication like the working curl script
        const authString = `${this.settings.jiraEmail}:${this.settings.jiraToken}`;
        const authBase64 = GLib.base64_encode(new TextEncoder().encode(authString));
        requestHeaders.append('Authorization', `Basic ${authBase64}`);
        requestHeaders.append('Accept', 'application/json');
        requestHeaders.append('User-Agent', 'GNOME-Jira-Extension/1.0');
        return new Promise((resolve, reject) => {
            this.session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (source: any, result: any) => {
                    try {
                        const inputStream = this.session.send_and_read_finish(result);
                        const bytes = inputStream.get_data();
                        
                        if (!bytes) {
                            console.error('JiraService: No response data received');
                            reject(new Error('No response data'));
                            return;
                        }

                        const text = new TextDecoder().decode(bytes);
                        const status = message.get_status();

                        if (status !== Soup.Status.OK) {
                            console.error('JiraService: HTTP error status:', status);
                            this.handleHttpError(status, text, reject);
                            return;
                        }

                        const response: JiraSearchResponse = JSON.parse(text);
                        resolve(response.issues || []);
                    } catch (error) {
                        console.error('JiraService: Error processing response:', error);
                        reject(new Error(`Failed to parse response: ${error}`));
                    }
                }
            );
        });
    }

    private handleHttpError(status: number, responseText: string, reject: (error: Error) => void) {
        console.error('JiraService: HTTP error:', status, responseText);
        
        let errorMessage = `HTTP ${status}`;

        try {
            const errorResponse: JiraErrorResponse = JSON.parse(responseText);
            
            if (errorResponse.errorMessages && errorResponse.errorMessages.length > 0) {
                errorMessage = errorResponse.errorMessages[0];
            } else if (errorResponse.errors) {
                const errorKeys = Object.keys(errorResponse.errors);
                if (errorKeys.length > 0) {
                    errorMessage = errorResponse.errors[errorKeys[0]];
                }
            }
        } catch (parseError) {
            console.error('JiraService: Failed to parse error response:', parseError);
            // If parsing fails, use the default error message
        }

        switch (status) {
            case Soup.Status.UNAUTHORIZED:
                reject(new Error('Authentication failed. Please check your Jira token.'));
                break;
            case Soup.Status.FORBIDDEN:
                reject(new Error('Access denied. Please check your permissions.'));
                break;
            case Soup.Status.NOT_FOUND:
                reject(new Error('Jira instance not found. Please check your URL.'));
                break;
            case Soup.Status.BAD_REQUEST:
                reject(new Error(`Invalid request: ${errorMessage}`));
                break;
            default:
                reject(new Error(`Request failed: ${errorMessage}`));
        }
    }

    formatIssue(issue: JiraIssue): string {
        const format = this.settings.issueFormat;
        return format
            .replace('{key}', issue.key)
            .replace('{summary}', issue.fields.summary || 'No summary')
            .replace('{status}', issue.fields.status?.name || 'Unknown')
            .replace('{assignee}', issue.fields.assignee?.displayName || 'Unassigned')
            .replace('{priority}', issue.fields.priority?.name || 'No priority')
            .replace('{type}', issue.fields.issuetype?.name || 'Unknown');
    }

    getIssueUrl(issue: JiraIssue): string {
        let baseUrl = this.settings.jiraUrl.trim();
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
            baseUrl = `https://${baseUrl}`;
        }
        baseUrl = baseUrl.replace(/\/$/, '');
        return `${baseUrl}/browse/${issue.key}`;
    }

    destroy() {
        // Session cleanup is handled by GC
    }
}