package com.example.todomoney.web;

import com.example.todomoney.repo.CurrencyEventRepository;
import com.example.todomoney.repo.UserRepository;
import com.example.todomoney.security.AppPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/me")
public class MeController {

  private final CurrencyEventRepository eventRepo;
  private final UserRepository userRepo;

  public MeController(CurrencyEventRepository eventRepo, UserRepository userRepo) {
    this.eventRepo = eventRepo;
    this.userRepo = userRepo;
  }

  public record SummaryResponse(double potentialTotal, double achievedTotal, long currencyCount) {}

  @GetMapping("/summary")
  public SummaryResponse summary(@AuthenticationPrincipal AppPrincipal p) {
    var user = userRepo.findById(p.userId()).orElseThrow();
    return new SummaryResponse(
        eventRepo.sumPotential(user),
        eventRepo.sumAchieved(user),
        eventRepo.countAll(user)
    );
  }
  @DeleteMapping
  @Transactional
  public ResponseEntity<Void> deleteMe(@AuthenticationPrincipal AppPrincipal p) {
    userRepo.deleteById(p.userId());
    return ResponseEntity.noContent().build();
  }

}
