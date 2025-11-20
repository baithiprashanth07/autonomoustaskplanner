/**
 * Tool implementations for the task planner
 * These tools are invoked by the LLM during task execution
 */

import { ToolResult } from "@shared/types";

/**
 * Web Search Tool - Search for information online
 * Uses a simple fetch-based approach to search
 */
export async function webSearch(query: string): Promise<ToolResult> {
  try {
    // Using a public search API or simple web search
    // For this implementation, we'll use a basic approach with DuckDuckGo or similar
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Search failed with status ${response.status}`,
      };
    }

    const data = await response.json();
    
    // Extract relevant results
    const results = {
      query,
      results: data.Results?.slice(0, 5).map((r: any) => ({
        title: r.Result,
        url: r.FirstURL,
        snippet: r.Text,
      })) || [],
      relatedTopics: data.RelatedTopics?.slice(0, 3).map((t: any) => ({
        topic: t.FirstURL || t.Text,
        description: t.Text,
      })) || [],
    };

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}

/**
 * Data Processing Tool - Perform calculations and data analysis
 */
export async function dataProcessor(operation: string, data: any): Promise<ToolResult> {
  try {
    switch (operation.toLowerCase()) {
      case "calculate_cagr": {
        // Calculate Compound Annual Growth Rate
        const { initialValue, finalValue, years } = data;
        if (!initialValue || !finalValue || !years) {
          return {
            success: false,
            error: "Missing required parameters: initialValue, finalValue, years",
          };
        }
        const cagr = (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100;
        return {
          success: true,
          data: { cagr: cagr.toFixed(2), percentage: `${cagr.toFixed(2)}%` },
        };
      }

      case "convert_temperature": {
        // Convert between temperature units
        const { value, from, to } = data;
        if (!value || !from || !to) {
          return {
            success: false,
            error: "Missing required parameters: value, from, to",
          };
        }

        let celsius = value;
        if (from.toLowerCase() === "fahrenheit") {
          celsius = (value - 32) * (5 / 9);
        } else if (from.toLowerCase() === "kelvin") {
          celsius = value - 273.15;
        }

        let result = celsius;
        if (to.toLowerCase() === "fahrenheit") {
          result = celsius * (9 / 5) + 32;
        } else if (to.toLowerCase() === "kelvin") {
          result = celsius + 273.15;
        }

        return {
          success: true,
          data: { value: result.toFixed(2), unit: to },
        };
      }

      case "calculate_percentage_change": {
        // Calculate percentage change between two values
        const { oldValue, newValue } = data;
        if (oldValue === undefined || newValue === undefined) {
          return {
            success: false,
            error: "Missing required parameters: oldValue, newValue",
          };
        }
        const percentageChange = ((newValue - oldValue) / oldValue) * 100;
        return {
          success: true,
          data: { percentageChange: percentageChange.toFixed(2), percentage: `${percentageChange.toFixed(2)}%` },
        };
      }

      case "compare_values": {
        // Compare multiple values and return statistics
        const { values } = data;
        if (!Array.isArray(values) || values.length === 0) {
          return {
            success: false,
            error: "Missing required parameter: values (array)",
          };
        }

        const numericValues = values.filter((v: any) => typeof v === "number");
        const sum = numericValues.reduce((a: number, b: number) => a + b, 0);
        const average = sum / numericValues.length;
        const sorted = [...numericValues].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];

        return {
          success: true,
          data: {
            count: numericValues.length,
            sum: sum.toFixed(2),
            average: average.toFixed(2),
            median: median.toFixed(2),
            min: Math.min(...numericValues).toFixed(2),
            max: Math.max(...numericValues).toFixed(2),
          },
        };
      }

      default:
        return {
          success: false,
          error: `Unknown operation: ${operation}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Data processing failed",
    };
  }
}

/**
 * API Fetcher Tool - Fetch data from specific APIs
 */
export async function apiFetcher(apiType: string, params: any): Promise<ToolResult> {
  try {
    switch (apiType.toLowerCase()) {
      case "weather": {
        // Fetch weather data from a public API
        const { city, country } = params;
        if (!city) {
          return {
            success: false,
            error: "Missing required parameter: city",
          };
        }

        // Using Open-Meteo API (free, no API key required)
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
          return {
            success: false,
            error: `City not found: ${city}`,
          };
        }

        const { latitude, longitude, name, country: foundCountry } = geoData.results[0];

        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=celsius`;
        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();

        return {
          success: true,
          data: {
            location: `${name}, ${foundCountry}`,
            temperature: weatherData.current.temperature_2m,
            unit: "celsius",
            windSpeed: weatherData.current.wind_speed_10m,
            weatherCode: weatherData.current.weather_code,
          },
        };
      }

      case "stock_price": {
        // Fetch stock price data
        const { symbol } = params;
        if (!symbol) {
          return {
            success: false,
            error: "Missing required parameter: symbol",
          };
        }

        // Using Alpha Vantage or similar (would need API key in production)
        // For now, returning a placeholder that would be replaced with real API
        return {
          success: true,
          data: {
            symbol,
            message: "Stock API integration would require API key",
            note: "In production, integrate with Alpha Vantage, Yahoo Finance, or similar",
          },
        };
      }

      case "currency_conversion": {
        // Fetch currency conversion rates
        const { from, to, amount } = params;
        if (!from || !to || !amount) {
          return {
            success: false,
            error: "Missing required parameters: from, to, amount",
          };
        }

        // Using a free currency API
        const url = `https://api.exchangerate-api.com/v4/latest/${from}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.rates || !data.rates[to]) {
          return {
            success: false,
            error: `Currency conversion not available for ${from} to ${to}`,
          };
        }

        const rate = data.rates[to];
        const convertedAmount = amount * rate;

        return {
          success: true,
          data: {
            from,
            to,
            amount,
            rate: rate.toFixed(4),
            convertedAmount: convertedAmount.toFixed(2),
          },
        };
      }

      default:
        return {
          success: false,
          error: `Unknown API type: ${apiType}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "API fetch failed",
    };
  }
}

/**
 * Execute a tool based on its name and parameters
 */
export async function executeTool(toolName: string, params: any): Promise<ToolResult> {
  switch (toolName.toLowerCase()) {
    case "web_search":
      return webSearch(params.query);
    case "data_processor":
      return dataProcessor(params.operation, params.data);
    case "api_fetcher":
      return apiFetcher(params.apiType, params.params);
    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
      };
  }
}
