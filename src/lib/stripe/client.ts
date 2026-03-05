import Stripe from "stripe";
import { stripeConfig } from "@/lib/stripe/config";

export const stripe = new Stripe(stripeConfig.secretKey, {
	apiVersion: "2024-06-20"
});
