import { base } from "$app/paths";
import { authCondition } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { redirect } from "@sveltejs/kit";
import cookie from "cookie"

export const actions = {
	delete: async function ({ locals, request }) {
		const cookies = cookie.parse(request.headers.get('cookie') || '');
		const walletAddress = cookies.walletAddress;
		// double check we have a user to delete conversations for
		if (locals.user?._id || locals.sessionId) {
			await collections.conversations.deleteMany({
				userAddress: walletAddress
			});
		}

		throw redirect(303, `${base}/`);
	},
};
