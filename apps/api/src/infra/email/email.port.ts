export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export abstract class EmailPort {
  abstract send(email: OutgoingEmail): Promise<void>;
}
