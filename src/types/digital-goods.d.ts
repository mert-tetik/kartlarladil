interface PaymentCurrencyAmount {
  currency: string;
  value: string;
}

interface DigitalGoodsItemDetails {
  itemId: string;
  title: string;
  description?: string;
  price: PaymentCurrencyAmount;
  type?: "product" | "subscription";
  subscriptionPeriod?: string;
  freeTrialPeriod?: string;
  introductoryPrice?: PaymentCurrencyAmount;
  introductoryPricePeriod?: string;
  introductoryPriceCycles?: number;
  iconURLs?: string[];
}

interface DigitalGoodsPurchaseDetails {
  itemId: string;
  purchaseToken: string;
}

interface DigitalGoodsService {
  getDetails(itemIds: string[]): Promise<DigitalGoodsItemDetails[]>;
  listPurchases(): Promise<DigitalGoodsPurchaseDetails[]>;
  listPurchaseHistory(): Promise<DigitalGoodsPurchaseDetails[]>;
  consume(purchaseToken: string): Promise<void>;
}

interface Window {
  getDigitalGoodsService?(provider: "https://play.google.com/billing"): Promise<DigitalGoodsService>;
}
