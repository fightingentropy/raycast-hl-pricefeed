import {
  ActionPanel,
  Action,
  List,
  showToast,
  Toast,
  Icon,
  Color,
} from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { useState, useMemo } from "react";
import React from "react";

interface AssetContext {
  markPx: string;
  prevDayPx: string;
  dayNtlVlm: string;
  funding: string;
  openInterest: string;
  midPx: string;
  impactPxs: string[];
  oraclePx: string;
  premium: string;
}

interface AssetInfo {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
  isDelisted?: boolean;
}

interface HyperliquidMetaAndAssetCtxsResponse {
  universe: AssetInfo[];
  assetCtxs: AssetContext[];
}

interface PriceItem {
  symbol: string;
  price: string;
  formattedPrice: string;
  priceChange24h: number;
  priceChangePercentage24h: string;
  isHype: boolean;
  isBtc: boolean;
  isSol: boolean;
}

export default function CheckPrices() {
  const [searchText, setSearchText] = useState("");

  const { data, isLoading, error } = useFetch<[{ universe: AssetInfo[] }, AssetContext[]]>(
    "https://api.hyperliquid.xyz/info",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "metaAndAssetCtxs",
      }),
      onError: (error: Error) => {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch prices",
          message: error.message,
        });
      },
    },
  );

  const priceItems: PriceItem[] = useMemo(() => {
    if (!data || !data[0] || !data[1]) return [];

    const { universe } = data[0];
    const assetCtxs = data[1];

    return universe
      .map((asset, index) => {
        const ctx = assetCtxs[index];
        if (!ctx) return null;

        const currentPrice = parseFloat(ctx.markPx);
        const prevDayPrice = parseFloat(ctx.prevDayPx);
        const priceChange = currentPrice - prevDayPrice;
        const priceChangePercent = prevDayPrice > 0 ? (priceChange / prevDayPrice) * 100 : 0;

        return {
          symbol: asset.name,
          price: ctx.markPx,
          formattedPrice: formatPrice(ctx.markPx),
          priceChange24h: priceChange,
          priceChangePercentage24h: formatPercentage(priceChangePercent),
          isHype: asset.name === "HYPE",
          isBtc: asset.name === "BTC",
          isSol: asset.name === "SOL",
        };
      })
      .filter((item): item is PriceItem => item !== null)
      .filter((item) => item.isBtc || item.isHype || item.isSol)
      .sort((a, b) => {
        // Order: BTC, SOL, HYPE
        if (a.isBtc && !b.isBtc) return -1;
        if (!a.isBtc && b.isBtc) return 1;
        if (a.isSol && b.isHype) return -1;
        if (a.isHype && b.isSol) return 1;
        return a.symbol.localeCompare(b.symbol);
      });
  }, [data]);

  const filteredItems = useMemo(() => {
    if (!searchText) {
      // Show HYPE and BTC by default when no search
      return priceItems.filter((item) => item.isHype || item.isBtc || item.isSol);
    }

    return priceItems.filter((item) =>
      item.symbol.toLowerCase().includes(searchText.toLowerCase()),
    );
  }, [priceItems, searchText]);

  function formatPrice(price: string): string {
    const num = parseFloat(price);
    if (num >= 1000) {
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    } else if (num >= 1) {
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }).format(num);
    } else {
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 6,
        maximumFractionDigits: 8,
      }).format(num);
    }
  }

  function formatPercentage(percentage: number): string {
    const sign = percentage >= 0 ? "+" : "";
    return `${sign}${percentage.toFixed(2)}%`;
  }

  function getPercentageColor(percentage: number): Color {
    if (percentage > 0) return Color.Green;
    if (percentage < 0) return Color.Red;
    return Color.SecondaryText;
  }

  function getIcon(symbol: string): Icon {
    if (symbol.toLowerCase().includes("hype")) {
      return Icon.Rocket;
    } else if (symbol.toLowerCase().includes("btc") || symbol === "BTC") {
      return Icon.Coins;
    } else if (symbol === "SOL") {
      return Icon.Sun;
    }
    return Icon.Circle;
  }

  function getIconColor(symbol: string): Color {
    if (symbol.toLowerCase().includes("hype")) {
      return Color.Orange;
    } else if (symbol.toLowerCase().includes("btc") || symbol === "BTC") {
      return Color.Yellow;
    } else if (symbol === "SOL") {
      return Color.Green;
    }
    return Color.SecondaryText;
  }

  if (error) {
    return (
      <List>
        <List.Item
          title="Error fetching prices"
          subtitle={error.message}
          icon={{ source: Icon.ExclamationMark, tintColor: Color.Red }}
        />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search for cryptocurrency prices..."
      throttle
    >
      <List.Section title={searchText ? "Search Results" : "Featured Prices"}>
        {filteredItems.map((item) => (
          <List.Item
            key={item.symbol}
            title={item.symbol}
            subtitle={`$${item.formattedPrice}`}
            icon={{
              source: getIcon(item.symbol),
              tintColor: getIconColor(item.symbol),
            }}
            accessories={[
              {
                text: item.priceChangePercentage24h,
                tooltip: `24h Change: ${item.priceChangePercentage24h}`,
                icon: {
                  source: item.priceChange24h >= 0 ? Icon.ArrowUpCircle : Icon.ArrowDownCircle,
                  tintColor: getPercentageColor(item.priceChange24h),
                },
              },
              {
                text: item.isBtc ? "BTC-PERP" : item.isHype ? "HYPE-PERP" : item.isSol ? "SOL-PERP" : "",
                tooltip: item.isBtc
                  ? "Bitcoin Perpetual"
                  : item.isHype
                    ? "Hyperliquid Perpetual"
                    : item.isSol
                      ? "Solana Perpetual"
                      : "",
              },
            ]}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  title="Copy Price"
                  content={item.price}
                  shortcut={{ modifiers: ["cmd"], key: "c" }}
                />
                <Action.CopyToClipboard
                  title="Copy Formatted Price"
                  content={`$${item.formattedPrice}`}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                />
                <Action.CopyToClipboard
                  title="Copy 24h Change"
                  content={item.priceChangePercentage24h}
                  shortcut={{ modifiers: ["cmd", "opt"], key: "c" }}
                />
                <Action.OpenInBrowser
                  title="View on Hyperliquid"
                  url={`https://app.hyperliquid.xyz/trade/${item.symbol}`}
                  shortcut={{ modifiers: ["cmd"], key: "o" }}
                />
              </ActionPanel>
            }
          />
        ))}
        {!isLoading && filteredItems.length === 0 && (
          <List.Item
            title="No prices found"
            subtitle={
              searchText
                ? `No results for "${searchText}"`
                : "Unable to load price data"
            }
            icon={{
              source: Icon.MagnifyingGlass,
              tintColor: Color.SecondaryText,
            }}
          />
        )}
      </List.Section>

      {searchText && (
        <List.Section title="All Available Assets">
          {priceItems
            .filter((item) => !filteredItems.includes(item))
            .slice(0, 20) // Limit to prevent performance issues
            .map((item) => (
              <List.Item
                key={`all-${item.symbol}`}
                title={item.symbol}
                subtitle={`$${item.formattedPrice}`}
                icon={{
                  source: Icon.Circle,
                  tintColor: Color.SecondaryText,
                }}
                accessories={[
                  {
                    text: item.priceChangePercentage24h,
                    tooltip: `24h Change: ${item.priceChangePercentage24h}`,
                    icon: {
                      source: item.priceChange24h >= 0 ? Icon.ArrowUpCircle : Icon.ArrowDownCircle,
                      tintColor: getPercentageColor(item.priceChange24h),
                    },
                  },
                ]}
                actions={
                  <ActionPanel>
                    <Action.CopyToClipboard
                      title="Copy Price"
                      content={item.price}
                    />
                    <Action.CopyToClipboard
                      title="Copy 24h Change"
                      content={item.priceChangePercentage24h}
                    />
                    <Action.OpenInBrowser
                      title="View on Hyperliquid"
                      url={`https://app.hyperliquid.xyz/trade/${item.symbol}`}
                    />
                  </ActionPanel>
                }
              />
            ))}
        </List.Section>
      )}
    </List>
  );
}
