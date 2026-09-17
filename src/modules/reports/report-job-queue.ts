import { Injectable, Logger } from '@nestjs/common';

const MAX_CONCURRENT_JOBS = 2;

/**
 * A minimal in-process job queue: report generation runs off the request
 * thread so a large report never holds an HTTP connection open, and at
 * most MAX_CONCURRENT_JOBS run at once so a burst of report requests can't
 * starve the database connection pool. This is deliberately not
 * Bull/Redis - at this scale a plain array and a counter does the same
 * job with one fewer moving part to operate in production.
 */
@Injectable()
export class ReportJobQueue {
  private readonly logger = new Logger(ReportJobQueue.name);
  private readonly queue: Array<() => Promise<void>> = [];
  private running = 0;

  enqueue(job: () => Promise<void>): void {
    this.queue.push(job);
    this.drain();
  }

  private drain(): void {
    while (this.running < MAX_CONCURRENT_JOBS && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.running++;
      job()
        .catch((error) => this.logger.error('Report job failed', error as Error))
        .finally(() => {
          this.running--;
          this.drain();
        });
    }
  }
}
