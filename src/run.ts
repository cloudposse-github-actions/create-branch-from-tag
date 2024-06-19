import * as core from "@actions/core";
import {Context} from "@actions/github/lib/context";
import {context, getOctokit} from "@actions/github"
import childProcess from "child_process";
import {GitHub} from "@actions/github/lib/utils";
import {RequestError} from "@octokit/types";

export async function run() {
  try {
    const branch = core.getInput('branch');
    const from = core.getInput('from');
    core.debug(`Creating branch ${branch}`);
    await createBranch(GitHub, context, branch, from)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error);
  }
}


export async function createBranch(github: any, context: Context, branch: string, from: string) {
  const octokit = getOctokit(githubToken());
  let branchExists;

  // Sometimes branch might come in with refs/heads already
  branch = branch.replace('refs/heads/', '');

  // Check to see if the branch already exists - if it does catch the error and create the branch
  core.debug(`Trying to get branch ${branch} from ${context.repo.owner}/${context.repo.repo}`)

  const branchResponse = await octokit.rest.repos.getBranch({
    ...context.repo,
    branch
  }).catch(async (error: RequestError) => {
    // Error was found - this is likely `Error: "HttpError": 404
    core.debug(`Error: "${error.name}": ${error.status} - ${error.errors}`);
    if (error.name === 'HttpError' && error.status === 404) {
      // Get the latest full SHA of the tag (from)
      const longSHA = childProcess.execSync('git rev-list -n 1 ' + from).toString().trim();
      core.debug(`Creating branch ${branch} from ${from} with SHA ${longSHA}`);
      await octokit.rest.git.createRef({
        ref: `refs/heads/${branch}`,
        sha: longSHA,
        ...context.repo
      }).catch((error: RequestError) => {
        throw error
      })
    } else {
      // If the error is not a 404 HttpError, we throw it
      throw error
    }
  })
}

function githubToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token)
    throw ReferenceError('No token defined in the environment variables');
  return token;
}
