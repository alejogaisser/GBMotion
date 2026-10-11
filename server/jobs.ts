/** Conserva todos los trabajos activos y sólo los últimos terminados recientes. */
export const pruneFinishedJobs = <T extends { status: string; createdAt: number; finishedAt?: number; active?: boolean }>(
  jobs: Map<string, T>,
  { now = Date.now(), maxFinished = 20, maxAgeMs = 3_600_000 } = {},
) => {
  const finished = [...jobs].filter(([, job]) => !job.active && job.status !== 'running' && job.status !== 'rendering')
    .sort((a, b) => (b[1].finishedAt ?? b[1].createdAt) - (a[1].finishedAt ?? a[1].createdAt));
  let kept = 0;
  for (const [id, job] of finished) {
    if (now - (job.finishedAt ?? job.createdAt) > maxAgeMs || kept >= maxFinished) jobs.delete(id);
    else kept++;
  }
};
