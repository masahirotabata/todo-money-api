package com.example.todomoney.web;

import com.example.todomoney.entity.InboxEntity;
import com.example.todomoney.entity.InboxEntity.InboxStatus;
import com.example.todomoney.repo.InboxRepository;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/inbox")
@CrossOrigin(origins = "*")
public class InboxController {

    private final InboxRepository inboxRepository;

    public InboxController(InboxRepository inboxRepository) {
        this.inboxRepository = inboxRepository;
    }

    @GetMapping
    public List<InboxEntity> getInboxItems(@RequestParam Long userId) {
        return inboxRepository.findByUserIdAndStatusOrderByCreatedAtDesc(
                userId,
                InboxStatus.INBOX
        );
    }

    @PostMapping
    public InboxEntity createInboxItem(@RequestBody CreateInboxRequest request) {
        InboxEntity item = new InboxEntity();
        item.setUserId(request.getUserId());
        item.setTitle(request.getTitle());
        item.setMemo(request.getMemo());
        item.setTargetDate(request.getTargetDate());
        item.setStatus(InboxStatus.INBOX);

        return inboxRepository.save(item);
    }

    @PutMapping("/{id}")
    public InboxEntity updateInboxItem(
            @PathVariable Long id,
            @RequestBody UpdateInboxRequest request
    ) {
        InboxEntity item = inboxRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Inbox item not found: " + id));

        if (request.getTitle() != null) {
            item.setTitle(request.getTitle());
        }

        if (request.getMemo() != null) {
            item.setMemo(request.getMemo());
        }

        if (request.getTargetDate() != null) {
            item.setTargetDate(request.getTargetDate());
        }

        return inboxRepository.save(item);
    }

    @PutMapping("/{id}/processed")
    public InboxEntity markProcessed(@PathVariable Long id) {
        InboxEntity item = inboxRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Inbox item not found: " + id));

        item.setStatus(InboxStatus.PROCESSED);

        return inboxRepository.save(item);
    }

    @DeleteMapping("/{id}")
    public void deleteInboxItem(@PathVariable Long id) {
        inboxRepository.deleteById(id);
    }

    public static class CreateInboxRequest {
        private Long userId;
        private String title;
        private String memo;
        private LocalDate targetDate;

        public Long getUserId() {
            return userId;
        }

        public void setUserId(Long userId) {
            this.userId = userId;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getMemo() {
            return memo;
        }

        public void setMemo(String memo) {
            this.memo = memo;
        }

        public LocalDate getTargetDate() {
            return targetDate;
        }

        public void setTargetDate(LocalDate targetDate) {
            this.targetDate = targetDate;
        }
    }

    public static class UpdateInboxRequest {
        private String title;
        private String memo;
        private LocalDate targetDate;

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getMemo() {
            return memo;
        }

        public void setMemo(String memo) {
            this.memo = memo;
        }

        public LocalDate getTargetDate() {
            return targetDate;
        }

        public void setTargetDate(LocalDate targetDate) {
            this.targetDate = targetDate;
        }
    }
}
