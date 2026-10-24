/** One environment variable a transport reads. */
export interface TransportVariable {
    name:        string;
    /** The application refuses to start without it when this transport is chosen. */
    required?:   boolean;
    example:     string;
    description: string;
}
