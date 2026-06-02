package com.example.todomoney.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/future")
@CrossOrigin(origins = "*")
public class FuturePlanController {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${openai.api.key:}")
    private String openAiApiKey;

    @Value("${openai.model:gpt-4o-mini}")
    private String model;

    @PostMapping("/plan")
    public ResponseEntity<FuturePlanResponse> createPlan(@RequestBody FuturePlanRequest request) {
        if (openAiApiKey == null || openAiApiKey.isBlank()) {
            return ResponseEntity.ok(createFallbackPlan(request));
        }

        try {
            Map<String, Object> body = Map.of(
                    "model", model,
                    "messages", List.of(
                            Map.of(
                                    "role", "system",
                                    "content", "あなたは目標達成プランを作るコーチです。必ずJSONのみを返してください。"
                            ),
                            Map.of("role", "user", "content", buildPrompt(request))
                    ),
                    "temperature", 0.6
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(openAiApiKey);

            ResponseEntity<String> response = restTemplate.postForEntity(
                    "https://api.openai.com/v1/chat/completions",
                    new HttpEntity<>(body, headers),
                    String.class
            );

            JsonNode root = objectMapper.readTree(response.getBody());
            String content = root.path("choices").path(0).path("message").path("content").asText();

            String json = cleanupJson(content);
            FuturePlanResponse planResponse = objectMapper.readValue(json, FuturePlanResponse.class);

            if (planResponse.items() == null || planResponse.items().isEmpty()) {
                return ResponseEntity.ok(createFallbackPlan(request));
            }

            return ResponseEntity.ok(planResponse);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.ok(createFallbackPlan(request));
        }
    }

    private String buildPrompt(FuturePlanRequest request) {
        return """
                次の目標を、カレンダー登録できる週間行動プランにしてください。

                目標: %s
                期限: %s
                1回あたり使える時間: %s分
                方向性: %s

                条件:
                - itemsは3件にしてください
                - weekdayは 0=日曜, 1=月曜, 2=火曜, 3=水曜, 4=木曜, 5=金曜, 6=土曜
                - startTime/endTimeは HH:mm 形式
                - 現実的で続けやすい内容にしてください
                - JSON以外の文章は絶対に返さないでください

                返却形式:
                {
                  "summary": "週3回、無理なく進めるプランです。",
                  "items": [
                    {
                      "title": "市場調査",
                      "weekday": 1,
                      "startTime": "21:00",
                      "endTime": "21:30",
                      "memo": "作りたいアプリや競合を調べる"
                    }
                  ]
                }
                """.formatted(
                safe(request.goal()),
                safe(request.deadline()),
                request.minutes() == null ? 30 : request.minutes(),
                safe(request.type())
        );
    }

    private String cleanupJson(String content) {
        if (content == null) return "{}";

        String cleaned = content.trim();

        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.replaceFirst("```json", "").trim();
        }

        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceFirst("```", "").trim();
        }

        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3).trim();
        }

        return cleaned;
    }

    private String safe(String value) {
        return value == null || value.isBlank() ? "未設定" : value;
    }

    private FuturePlanResponse createFallbackPlan(FuturePlanRequest request) {
        int minutes = request.minutes() == null ? 30 : request.minutes();
        String endTime = minutes <= 30 ? "21:30" : "22:00";

        return new FuturePlanResponse(
                "まずは週3回、小さく進めるプランです。",
                List.of(
                        new FuturePlanItem("市場調査", 1, "21:00", endTime, "目標に近い事例や競合を調べる"),
                        new FuturePlanItem("実装・実行", 3, "21:00", endTime, "小さく1つだけ行動を進める"),
                        new FuturePlanItem("振り返り", 5, "21:00", endTime, "今週できたことと次の一歩を整理する")
                )
        );
    }

    public record FuturePlanRequest(
            String goal,
            String deadline,
            Integer minutes,
            String type
    ) {}

    public record FuturePlanResponse(
            String summary,
            List<FuturePlanItem> items
    ) {}

    public record FuturePlanItem(
            String title,
            Integer weekday,
            String startTime,
            String endTime,
            String memo
    ) {}
}