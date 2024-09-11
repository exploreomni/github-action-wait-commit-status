const core = require('@actions/core');
const github = require('@actions/github');
const repoToken = core.getInput('token');
const client = github.getOctokit(repoToken);

const check_retry_count = core.getInput('check-retry-count');
const check_retry_interval = core.getInput('check-retry-interval');

// Function to wait for a specific commit status to become a success
async function waitForCommitStatus(owner, repo, commitSha, statusContext, options = {}) {
    const { retryCount = 10, retryInterval = 5000 } = options;

    let attemptCount = 0;


    while (true) {
        const response = await client.rest.repos.listCommitStatusesForRef({
            owner, repo, ref: commitSha,
        });

        console.log(JSON.stringify(response, null, 2))
        const { data: statuses } = response
        console.log(`Found these commit status contexts: ${statuses.map((s) => s.context)}`)

        const matchingStatus = statuses.find((status) => status.context === statusContext);
        if (matchingStatus && matchingStatus.state === 'success') {
            console.log(`Commit status "${statusContext}" is now success.`);
            return true;
        }

        if (matchingStatus && (matchingStatus.state === 'failure' || matchingStatus.state === 'error')) {
            console.log(`Commit status "${statusContext}" is now ${matchingStatus.state}.`);
            return false;
        }

        if (attemptCount >= retryCount) {
            console.log(`Exceeded maximum retry count. Exiting...`);
            return false;
        }

        attemptCount++;

        console.log(`Waiting for commit status "${statusContext}" to become success...`);

        await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }
}


const main = async function() {
    try {
        // Usage
        const repository = core.getInput('repository');
        const sha = core.getInput('sha');
        const status = core.getInput('status');

        const options = {
            retryCount: check_retry_count, // Retry 5 times before giving up
            retryInterval: 1000 * check_retry_interval // Convert from seconds to milliseconds
        };

        owner = repository.split("/")[0]
        repo = repository.split("/")[1]

        const test = await waitForCommitStatus(owner, repo, sha, status, options)
            .then((result) => {
                console.log("Done waiting.");
                if (result) {
                    process.exit(0)
                }
                process.exit(1)
            })
            .catch((error) => {
                console.error("Error:", error);
                process.exit(1); // Exit with status code 1
            });

    } catch (error) {
        core.setFailed(error.message);
    }
}

main()

