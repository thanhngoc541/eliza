import { elizaLogger, settings } from "@elizaos/core";

import {
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
    type Action,
} from "@elizaos/core";
import { composeContext } from "@elizaos/core";
import { CardanoToolKit } from "cardano-agent-kit";

import { generateObjectDeprecated } from "@elizaos/core";
import { ProviderType, NetworkType } from "cardano-agent-kit/dist/toolkit";

interface SendLovelaceContent extends Content {
    recipient: string;
    amount: number;
}

function isSendLovelaceContent(
    content: any
): content is SendLovelaceContent {
    return (
        typeof content.recipient === "string" &&
        typeof content.amount === "number"
    );
}

const sendLovelaceTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "recipient": "addr_test1qqpnp9n7274je4mugywj890pp9w6hexceedhvryfrgs7gqxl9g3ghpcdgv2j58fe7yvpwt6nqc2ylzjr4k8zldetjlvq80w9t3",
    "amount": 123456
}
\`\`\`

{{recentMessages}}

Extract the following information about the requested Lovelace transfer:
- Recipient wallet address
- Amount of Lovelace to transfer
`;

export const sendLovelaceAction: Action = {
    name: "SEND_LOVELACE",
    similes: ["TRANSFER_LOVELACE", "PAY_LOVELACE"],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        elizaLogger.log("Validating LOVELACE transfer from user:", message.userId);
        return true;
    },
    description: "Transfer LOVELACE from agent's wallet to specified address",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting SEND_LOVELACE handler...");
        callback({ text: "Starting SEND_LOVELACE handler..." });
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const transferContext = composeContext({
            state,
            template: sendLovelaceTemplate,
        });
        const content = await generateObjectDeprecated({
            runtime,
            context: transferContext,
            modelClass: ModelClass.LARGE,
        });

        try {
            const cardanoProvider = runtime.getSetting("CARDANO_PROVIDER") as ProviderType;
            const cardanoProviderAPIKey = runtime.getSetting("CARDANO_PROVIDER_API_KEY");
            const cardanoNetwork = runtime.getSetting("CARDANO_NETWORK") as NetworkType;
            const privateKey = runtime.getSetting("CARDANO_PRIVATE_KEY");

            const toolkit = new CardanoToolKit(cardanoProvider, cardanoProviderAPIKey, cardanoNetwork, privateKey,);
            const balance = await toolkit.getBalance();
            callback({
                text: `Current balance: ${balance} LOVELACE`,
                content: { balance },
            });
            const signature = await toolkit.sendLovelace(content.recipient, content.amount.toString());

            if (callback) {
                callback({
                    text: `Sent ${content.amount} LOVELACE. Transaction hash: ${signature}`,
                    content: {
                        success: true,
                        signature,
                        amount: content.amount,
                        recipient: content.recipient,
                    },
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error during send Lovelace:", error);
            if (callback) {
                callback({
                    text: `Problem with the send Lovelace: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Send to address addr_test1qqpnp9n7274je4mugywj890pp9w6hexceedhvryfrgs7gqxl9g3ghpcdgv2j58fe7yvpwt6nqc2ylzjr4k8zldetjlvq80w9t3 123456 LOVELACE",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Sending LOVELACE to addr_test1qqpnp9n7274je4mugywj890pp9w6hexceedhvryfrgs7gqxl9g3ghpcdgv2j58fe7yvpwt6nqc2ylzjr4k8zldetjlvq80w9t3 now.",
                    action: "SEND_LOVELACE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "perform action SEND_LOVELACE send to recipient address: addr_test1qqpnp9n7274je4mugywj890pp9w6hexceedhvryfrgs7gqxl9g3ghpcdgv2j58fe7yvpwt6nqc2ylzjr4k8zldetjlvq80w9t3 amount of 1000000 lovelace",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Transfer LOVELACE to addr_test1qqpnp9n7274je4mugywj890pp9w6hexceedhvryfrgs7gqxl9g3ghpcdgv2j58fe7yvpwt6nqc2ylzjr4k8zldetjlvq80w9t3 now.",
                    action: "SEND_LOVELACE",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;